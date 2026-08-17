import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateAddress, assertSafeUrl, UnsafeUrlError, crawlerUserAgent, mapLimit } from '../src/io/fetcher.js';
import { normaliseUrl } from '../src/io/audit.js';

describe('isPrivateAddress', () => {
  test('rejects IPv4 ranges that are not publicly routable', () => {
    for (const address of [
      '127.0.0.1',
      '10.0.0.1',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254', // cloud metadata — the classic SSRF target
      '100.64.0.1', // carrier-grade NAT
      '0.0.0.0',
      '224.0.0.1', // multicast
    ]) {
      assert.equal(isPrivateAddress(address), true, `${address} must be rejected`);
    }
  });

  test('allows public IPv4 addresses', () => {
    for (const address of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.32.0.1', '172.15.0.1']) {
      assert.equal(isPrivateAddress(address), false, `${address} must be allowed`);
    }
  });

  test('rejects non-routable IPv6, including IPv4-mapped loopback', () => {
    for (const address of ['::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', '::ffff:127.0.0.1']) {
      assert.equal(isPrivateAddress(address), true, `${address} must be rejected`);
    }
  });

  test('allows public IPv6', () => {
    assert.equal(isPrivateAddress('2606:4700:4700::1111'), false);
  });

  test('treats anything unparseable as unsafe', () => {
    assert.equal(isPrivateAddress('not-an-address'), true);
  });
});

describe('assertSafeUrl', () => {
  test('rejects non-HTTP schemes', async () => {
    for (const url of ['file:///etc/passwd', 'ftp://example.com', 'gopher://example.com']) {
      await assert.rejects(() => assertSafeUrl(url), UnsafeUrlError);
    }
  });

  test('rejects loopback and internal hostnames without a DNS lookup', async () => {
    for (const url of ['http://localhost/', 'http://foo.localhost/', 'http://svc.internal/']) {
      await assert.rejects(() => assertSafeUrl(url), UnsafeUrlError);
    }
  });

  test('rejects literal private addresses', async () => {
    await assert.rejects(() => assertSafeUrl('http://169.254.169.254/latest/meta-data/'), UnsafeUrlError);
    await assert.rejects(() => assertSafeUrl('http://[::1]:8080/'), UnsafeUrlError);
  });

  test('rejects malformed URLs', async () => {
    await assert.rejects(() => assertSafeUrl('http://'), UnsafeUrlError);
  });
});

describe('normaliseUrl', () => {
  test('adds a scheme when the user types a bare host', () => {
    assert.equal(normaliseUrl('example.com'), 'https://example.com/');
    assert.equal(normaliseUrl('  example.com/pricing '), 'https://example.com/pricing');
  });

  test('preserves an explicit scheme', () => {
    assert.equal(normaliseUrl('http://example.com'), 'http://example.com/');
  });

  test('strips the fragment, which never reaches the server', () => {
    assert.equal(normaliseUrl('https://example.com/a#section'), 'https://example.com/a');
  });

  test('rejects empty input', () => {
    assert.throws(() => normaliseUrl('   '), UnsafeUrlError);
  });
});

describe('crawlerUserAgent', () => {
  test('returns the documented string for known crawlers', () => {
    assert.match(crawlerUserAgent('GPTBot'), /GPTBot\/\d/);
    assert.match(crawlerUserAgent('OAI-SearchBot'), /OAI-SearchBot/);
    assert.match(crawlerUserAgent('ClaudeBot'), /ClaudeBot/);
  });

  test('falls back to a well-formed string for unknown tokens', () => {
    assert.equal(crawlerUserAgent('NewBot'), 'Mozilla/5.0 (compatible; NewBot/1.0)');
  });
});

describe('mapLimit', () => {
  test('preserves input order regardless of completion order', async () => {
    const tasks = [30, 5, 20, 1].map((ms, i) => async () => {
      await new Promise((r) => setTimeout(r, ms));
      return i;
    });
    assert.deepEqual(await mapLimit(tasks, 2), [0, 1, 2, 3]);
  });

  test('never exceeds the concurrency limit', async () => {
    let active = 0;
    let peak = 0;
    const tasks = Array.from({ length: 12 }, () => async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return null;
    });

    await mapLimit(tasks, 3);
    assert.ok(peak <= 3, `peak concurrency was ${peak}`);
  });

  test('handles an empty task list', async () => {
    assert.deepEqual(await mapLimit([], 4), []);
  });
});
