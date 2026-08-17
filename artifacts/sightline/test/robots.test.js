import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRobotsTxt,
  isAllowed,
  selectGroup,
  selectRule,
  pathMatches,
  isFullyBlocked,
} from '../src/core/robots.js';

describe('parseRobotsTxt', () => {
  test('parses groups, rules and sitemaps', () => {
    const doc = parseRobotsTxt(
      [
        '# a comment',
        'User-agent: GPTBot',
        'Disallow: /private',
        'Allow: /private/public',
        '',
        'User-agent: *',
        'Disallow:',
        'Sitemap: https://example.com/sitemap.xml',
      ].join('\n'),
    );

    assert.equal(doc.groups.length, 2);
    assert.deepEqual(doc.groups[0].agents, ['gptbot']);
    assert.equal(doc.groups[0].rules.length, 2);
    assert.deepEqual(doc.sitemaps, ['https://example.com/sitemap.xml']);
  });

  test('consecutive user-agent lines share one rule set', () => {
    const doc = parseRobotsTxt(
      ['User-agent: GPTBot', 'User-agent: CCBot', 'Disallow: /'].join('\n'),
    );
    assert.equal(doc.groups.length, 1);
    assert.deepEqual(doc.groups[0].agents, ['gptbot', 'ccbot']);
  });

  test('a user-agent line after a rule starts a new group', () => {
    const doc = parseRobotsTxt(
      ['User-agent: GPTBot', 'Disallow: /', 'User-agent: CCBot', 'Disallow: /x'].join('\n'),
    );
    assert.equal(doc.groups.length, 2);
  });

  test('empty Disallow means allow everything', () => {
    const doc = parseRobotsTxt(['User-agent: *', 'Disallow:'].join('\n'));
    assert.equal(doc.groups[0].rules[0].type, 'allow');
    assert.equal(isAllowed(doc, 'GPTBot', '/anything').allowed, true);
  });

  test('strips a UTF-8 BOM so the first group is not silently inert', () => {
    const doc = parseRobotsTxt('﻿User-agent: *\nDisallow: /x');
    assert.equal(doc.groups.length, 1);
    assert.deepEqual(doc.groups[0].agents, ['*']);
  });

  test('strips inline comments', () => {
    const doc = parseRobotsTxt('User-agent: GPTBot # training bot\nDisallow: /a # nope');
    assert.deepEqual(doc.groups[0].agents, ['gptbot']);
    assert.equal(doc.groups[0].rules[0].path, '/a');
  });

  test('handles CRLF line endings', () => {
    const doc = parseRobotsTxt('User-agent: *\r\nDisallow: /admin\r\n');
    assert.equal(doc.groups[0].rules[0].path, '/admin');
  });

  test('reports a rule that appears before any user-agent', () => {
    const doc = parseRobotsTxt('Disallow: /\nUser-agent: *\nAllow: /');
    assert.equal(doc.issues.filter((i) => i.severity === 'error').length, 1);
    assert.match(doc.issues[0].message, /before any User-agent/);
  });

  test('reports a line with no colon', () => {
    const doc = parseRobotsTxt('User-agent: *\nDisallow /admin');
    assert.equal(doc.issues.length, 1);
    assert.equal(doc.issues[0].severity, 'warning');
  });

  test('ignores unknown fields without complaint', () => {
    const doc = parseRobotsTxt('User-agent: *\nRequest-rate: 1/5\nDisallow: /x');
    assert.equal(doc.issues.length, 0);
    assert.equal(doc.groups[0].rules.length, 1);
  });

  test('records line numbers so findings can cite them', () => {
    const doc = parseRobotsTxt(['', 'User-agent: GPTBot', 'Disallow: /'].join('\n'));
    assert.equal(doc.groups[0].line, 2);
    assert.equal(doc.groups[0].rules[0].line, 3);
  });
});

describe('pathMatches', () => {
  test('treats patterns as prefixes', () => {
    assert.equal(pathMatches('/admin', '/admin/users'), true);
    assert.equal(pathMatches('/admin', '/public'), false);
  });

  test('supports * wildcards', () => {
    assert.equal(pathMatches('/*.pdf', '/docs/file.pdf'), true);
    assert.equal(pathMatches('/a/*/c', '/a/b/c'), true);
    assert.equal(pathMatches('/a/*/c', '/a/b/d'), false);
  });

  test('supports the $ end anchor', () => {
    assert.equal(pathMatches('/page$', '/page'), true);
    assert.equal(pathMatches('/page$', '/page/sub'), false);
    assert.equal(pathMatches('/*.php$', '/index.php'), true);
    assert.equal(pathMatches('/*.php$', '/index.php?x=1'), false);
  });

  test('escapes regex metacharacters in literal segments', () => {
    assert.equal(pathMatches('/a+b', '/a+b/c'), true);
    assert.equal(pathMatches('/a+b', '/aab'), false);
  });

  test('an empty pattern matches nothing', () => {
    assert.equal(pathMatches('', '/'), false);
  });
});

describe('selectRule — most specific wins', () => {
  test('longest matching pattern wins regardless of order', () => {
    const rules = [
      { type: /** @type {const} */ ('disallow'), path: '/', line: 1 },
      { type: /** @type {const} */ ('allow'), path: '/blog/public', line: 2 },
    ];
    const winner = selectRule(rules, '/blog/public/post');
    assert.equal(winner?.type, 'allow');
  });

  test('a later, shorter rule does not override an earlier, longer one', () => {
    const rules = [
      { type: /** @type {const} */ ('allow'), path: '/blog/public', line: 1 },
      { type: /** @type {const} */ ('disallow'), path: '/blog', line: 2 },
    ];
    assert.equal(selectRule(rules, '/blog/public/x')?.type, 'allow');
  });

  test('allow wins an exact-length tie', () => {
    const rules = [
      { type: /** @type {const} */ ('disallow'), path: '/page', line: 1 },
      { type: /** @type {const} */ ('allow'), path: '/page', line: 2 },
    ];
    assert.equal(selectRule(rules, '/page')?.type, 'allow');
  });

  test('returns null when nothing matches', () => {
    const rules = [{ type: /** @type {const} */ ('disallow'), path: '/admin', line: 1 }];
    assert.equal(selectRule(rules, '/public'), null);
  });
});

describe('selectGroup — prefix matching', () => {
  test('a short token catches every bot sharing that prefix', () => {
    // The headline misconfiguration: "Claude" was meant to stop the training
    // bot, but it also disallows Claude-SearchBot and Claude-User.
    const doc = parseRobotsTxt('User-agent: Claude\nDisallow: /');
    assert.ok(selectGroup(doc, 'ClaudeBot'));
    assert.ok(selectGroup(doc, 'Claude-SearchBot'));
    assert.ok(selectGroup(doc, 'Claude-User'));
    assert.equal(isFullyBlocked(doc, 'Claude-SearchBot'), true);
  });

  test('the longest matching token wins, and groups are not merged', () => {
    const doc = parseRobotsTxt(
      [
        'User-agent: Claude',
        'Disallow: /',
        '',
        'User-agent: Claude-SearchBot',
        'Allow: /',
        'Disallow: /private',
      ].join('\n'),
    );
    // Claude-SearchBot obeys only its own, more specific group.
    assert.equal(isAllowed(doc, 'Claude-SearchBot', '/blog').allowed, true);
    assert.equal(isAllowed(doc, 'Claude-SearchBot', '/private').allowed, false);
    // ClaudeBot still falls under the broad group.
    assert.equal(isAllowed(doc, 'ClaudeBot', '/blog').allowed, false);
  });

  test('a named group beats the wildcard even when more permissive', () => {
    const doc = parseRobotsTxt(
      ['User-agent: *', 'Disallow: /', '', 'User-agent: OAI-SearchBot', 'Disallow:'].join('\n'),
    );
    assert.equal(isAllowed(doc, 'OAI-SearchBot', '/x').allowed, true);
    assert.equal(isAllowed(doc, 'GPTBot', '/x').allowed, false);
  });

  test('matching is case-insensitive in both directions', () => {
    const doc = parseRobotsTxt('User-agent: gptBOT\nDisallow: /');
    assert.equal(isFullyBlocked(doc, 'GPTBot'), true);
  });

  test('reports whether the verdict came from a named group or the wildcard', () => {
    const doc = parseRobotsTxt(
      ['User-agent: *', 'Disallow: /admin', '', 'User-agent: GPTBot', 'Disallow: /'].join('\n'),
    );
    assert.equal(isAllowed(doc, 'GPTBot', '/').basis, 'explicit');
    assert.equal(isAllowed(doc, 'Applebot', '/admin').basis, 'wildcard');
  });

  test('unmatched agents default to allowed', () => {
    const doc = parseRobotsTxt('User-agent: GPTBot\nDisallow: /');
    const decision = isAllowed(doc, 'Applebot', '/');
    assert.equal(decision.allowed, true);
    assert.equal(decision.basis, 'default');
  });
});

describe('isAllowed — absent and empty files', () => {
  test('a missing robots.txt allows everything', () => {
    const doc = parseRobotsTxt('', { present: false });
    assert.equal(isAllowed(doc, 'GPTBot', '/').allowed, true);
    assert.equal(isAllowed(doc, 'GPTBot', '/').basis, 'default');
  });

  test('an empty robots.txt allows everything', () => {
    const doc = parseRobotsTxt('');
    assert.equal(isAllowed(doc, 'OAI-SearchBot', '/').allowed, true);
  });

  test('the winning rule is returned as evidence', () => {
    const doc = parseRobotsTxt('User-agent: OAI-SearchBot\nDisallow: /');
    const decision = isAllowed(doc, 'OAI-SearchBot', '/pricing');
    assert.equal(decision.rule?.line, 2);
    assert.equal(decision.rule?.path, '/');
  });
});
