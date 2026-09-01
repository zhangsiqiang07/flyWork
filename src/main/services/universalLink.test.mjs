import assert from 'node:assert/strict'
import test from 'node:test'
import {
  extractDomainAndUrl,
  validateAasa,
  matchUrlAgainstAasa,
  generateAasaTemplate
} from './universalLink.js'

test('extractDomainAndUrl parses various domain and URL formats correctly', () => {
  const t1 = extractDomainAndUrl('example.com')
  assert.equal(t1.domain, 'example.com')
  assert.equal(t1.url.pathname, '/')

  const t2 = extractDomainAndUrl('https://sub.domain.com/shop/item/123?utm=ios#section')
  assert.equal(t2.domain, 'sub.domain.com')
  assert.equal(t2.url.pathname, '/shop/item/123')
  assert.equal(t2.url.searchParams.get('utm'), 'ios')
  assert.equal(t2.url.hash, '#section')

  const t3 = extractDomainAndUrl('   ')
  assert.equal(t3.domain, '')
  assert.ok(t3.error)
})

test('validateAasa validates modern, legacy, and hybrid AASA structures', () => {
  // Invalid JSON
  const inv = validateAasa(null)
  assert.equal(inv.valid, false)

  // Missing applinks
  const noApplinks = validateAasa({ webcredentials: {} })
  assert.equal(noApplinks.valid, false)

  // Valid Modern
  const modernAasa = {
    applinks: {
      apps: [],
      details: [
        {
          appIDs: ['ABCDE12345.com.example.modern'],
          components: [
            { '/': '/goods/*', '?': { id: '?*' } },
            { '/': '/pay/*', exclude: true }
          ]
        }
      ]
    }
  }
  const valModern = validateAasa(modernAasa)
  assert.equal(valModern.valid, true)
  assert.equal(valModern.format, 'modern (iOS 13+)')
  assert.equal(valModern.summary.appCount, 1)

  // Valid Legacy
  const legacyAasa = {
    applinks: {
      apps: [],
      details: [
        {
          appID: 'ABCDE12345.com.example.legacy',
          paths: ['/articles/*', 'NOT /secret/*']
        }
      ]
    }
  }
  const valLegacy = validateAasa(legacyAasa)
  assert.equal(valLegacy.valid, true)
  assert.equal(valLegacy.format, 'legacy (iOS 9-12)')
  assert.equal(valLegacy.summary.appCount, 1)
})

test('matchUrlAgainstAasa correctly evaluates modern components rules and excludes', () => {
  const aasa = {
    applinks: {
      apps: [],
      details: [
        {
          appIDs: ['ABCDE12345.com.example.store'],
          components: [
            { '/': '/goods/*', '?': { id: '?*' }, comment: '商品详情' },
            { '/': '/pay/*', exclude: true, comment: '禁止网页唤起支付' },
            { '/': '/promo/*', '#': 'openapp', comment: '锚点匹配' },
            { '/': '/help/*' }
          ]
        }
      ]
    }
  }

  // 1. Matched path + query
  const hitGoods = matchUrlAgainstAasa(aasa, 'https://example.com/goods/view?id=10086')
  assert.equal(hitGoods.matched, true)
  assert.equal(hitGoods.matchedAppId, 'ABCDE12345.com.example.store')
  assert.equal(hitGoods.ruleType, 'modern')

  // 2. Query param missing -> does not match rule 1, falls through
  const noQueryGoods = matchUrlAgainstAasa(aasa, 'https://example.com/goods/view')
  assert.equal(noQueryGoods.matched, false)

  // 3. Exclude rule
  const hitPay = matchUrlAgainstAasa(aasa, 'https://example.com/pay/confirm')
  assert.equal(hitPay.matched, false)
  assert.equal(hitPay.isExcluded, true)

  // 4. Fragment rule
  const hitPromo = matchUrlAgainstAasa(aasa, 'https://example.com/promo/summer#openapp')
  assert.equal(hitPromo.matched, true)

  // 5. Unmatched
  const hitRandom = matchUrlAgainstAasa(aasa, 'https://example.com/about/us')
  assert.equal(hitRandom.matched, false)
  assert.equal(hitRandom.isExcluded, false)
})

test('matchUrlAgainstAasa correctly evaluates legacy paths rules', () => {
  const aasa = {
    applinks: {
      apps: [],
      details: [
        {
          appID: 'ABCDE12345.com.example.blog',
          paths: ['NOT /secret/*', '/posts/*']
        }
      ]
    }
  }

  const hitPost = matchUrlAgainstAasa(aasa, 'https://example.com/posts/my-first-post')
  assert.equal(hitPost.matched, true)
  assert.equal(hitPost.matchedAppId, 'ABCDE12345.com.example.blog')

  const hitSecret = matchUrlAgainstAasa(aasa, 'https://example.com/secret/admin')
  assert.equal(hitSecret.matched, false)
  assert.equal(hitSecret.isExcluded, true)
})

test('generateAasaTemplate produces valid schema', () => {
  const tModern = generateAasaTemplate({
    teamId: 'TEAMID9999',
    bundleId: 'com.test.app',
    format: 'modern'
  })
  const v1 = validateAasa(tModern)
  assert.equal(v1.valid, true)
  assert.equal(tModern.applinks.details[0].appIDs[0], 'TEAMID9999.com.test.app')

  const tLegacy = generateAasaTemplate({
    teamId: 'TEAMID9999',
    bundleId: 'com.test.app',
    format: 'legacy'
  })
  const v2 = validateAasa(tLegacy)
  assert.equal(v2.valid, true)
  assert.equal(tLegacy.applinks.details[0].appID, 'TEAMID9999.com.test.app')
})
