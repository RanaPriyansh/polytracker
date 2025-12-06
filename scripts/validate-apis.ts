/**
 * Polymarket API Validation Script
 * Phase 0: Data Source Validation
 * 
 * Tests all three Polymarket APIs to verify availability and response formats.
 * Run: npx tsx scripts/validate-apis.ts
 */

// Known active trader for testing (Polymarket whale)
const TEST_WALLET = "0x1234567890abcdef1234567890abcdef12345678"; // Placeholder - will find real one

interface APITestResult {
    endpoint: string;
    status: "SUCCESS" | "FAILED" | "RATE_LIMITED";
    statusCode: number;
    responseTime: number;
    dataShape: string;
    error?: string;
}

const results: APITestResult[] = [];

async function testEndpoint(
    name: string,
    url: string
): Promise<APITestResult> {
    const start = Date.now();

    try {
        const response = await fetch(url, {
            headers: {
                "Accept": "application/json",
                "User-Agent": "PolyTracker/1.0"
            }
        });

        const responseTime = Date.now() - start;
        const statusCode = response.status;

        if (statusCode === 429) {
            return {
                endpoint: name,
                status: "RATE_LIMITED",
                statusCode,
                responseTime,
                dataShape: "N/A",
                error: "Rate limit exceeded"
            };
        }

        if (!response.ok) {
            return {
                endpoint: name,
                status: "FAILED",
                statusCode,
                responseTime,
                dataShape: "N/A",
                error: `HTTP ${statusCode}`
            };
        }

        const data = await response.json();
        const dataShape = Array.isArray(data)
            ? `Array[${data.length}]`
            : typeof data === 'object'
                ? `Object{${Object.keys(data).slice(0, 5).join(', ')}...}`
                : typeof data;

        return {
            endpoint: name,
            status: "SUCCESS",
            statusCode,
            responseTime,
            dataShape
        };

    } catch (error) {
        return {
            endpoint: name,
            status: "FAILED",
            statusCode: 0,
            responseTime: Date.now() - start,
            dataShape: "N/A",
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

async function findActiveWallet(): Promise<string | null> {
    console.log("🔍 Finding an active wallet from recent trades...\n");

    try {
        // Get recent trades to find an active wallet
        const response = await fetch(
            "https://data-api.polymarket.com/trades?limit=10"
        );

        if (!response.ok) {
            console.log("⚠️  Could not fetch recent trades to find wallet");
            return null;
        }

        const trades = await response.json();

        if (Array.isArray(trades) && trades.length > 0) {
            // Get the first trade's maker or taker address
            const wallet = trades[0].maker || trades[0].taker || trades[0].proxyWallet;
            if (wallet) {
                console.log(`✅ Found active wallet: ${wallet}\n`);
                return wallet;
            }
        }

        return null;
    } catch (error) {
        console.log("⚠️  Error finding wallet:", error);
        return null;
    }
}

async function main() {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("       POLYMARKET API VALIDATION - Phase 0");
    console.log("═══════════════════════════════════════════════════════════\n");

    // First, try to find a real active wallet
    const activeWallet = await findActiveWallet();
    const walletToTest = activeWallet || TEST_WALLET;

    console.log(`Testing with wallet: ${walletToTest}\n`);
    console.log("───────────────────────────────────────────────────────────\n");

    // ═══════════════════════════════════════════════════════════
    // DATA-API Tests
    // ═══════════════════════════════════════════════════════════
    console.log("📊 DATA-API (data-api.polymarket.com)\n");

    const dataApiTests = [
        ["GET /trades (public)", "https://data-api.polymarket.com/trades?limit=5"],
        ["GET /positions", `https://data-api.polymarket.com/positions?user=${walletToTest}`],
        ["GET /activity", `https://data-api.polymarket.com/activity?user=${walletToTest}`],
    ];

    for (const [name, url] of dataApiTests) {
        const result = await testEndpoint(name, url);
        results.push(result);
        printResult(result);
        await sleep(500); // Respectful delay between requests
    }

    // ═══════════════════════════════════════════════════════════
    // GAMMA-API Tests
    // ═══════════════════════════════════════════════════════════
    console.log("\n📈 GAMMA-API (gamma-api.polymarket.com)\n");

    const gammaApiTests = [
        ["GET /events", "https://gamma-api.polymarket.com/events?limit=5&active=true"],
        ["GET /markets", "https://gamma-api.polymarket.com/markets?limit=5"],
    ];

    for (const [name, url] of gammaApiTests) {
        const result = await testEndpoint(name, url);
        results.push(result);
        printResult(result);
        await sleep(500);
    }

    // ═══════════════════════════════════════════════════════════
    // CLOB-API Tests
    // ═══════════════════════════════════════════════════════════
    console.log("\n💹 CLOB-API (clob.polymarket.com)\n");

    // First get a valid token_id from gamma
    let tokenId = "71321045679252212594626385532706912750332728571942532289631379312455583992563"; // Fallback

    try {
        const marketsRes = await fetch("https://gamma-api.polymarket.com/markets?limit=1&active=true");
        if (marketsRes.ok) {
            const markets = await marketsRes.json();
            if (markets[0]?.clobTokenIds?.[0]) {
                tokenId = markets[0].clobTokenIds[0];
            }
        }
    } catch (e) {
        console.log("Using fallback token ID");
    }

    const clobApiTests = [
        ["GET /markets", "https://clob.polymarket.com/markets"],
        ["GET /midpoint", `https://clob.polymarket.com/midpoint?token_id=${tokenId}`],
    ];

    for (const [name, url] of clobApiTests) {
        const result = await testEndpoint(name, url);
        results.push(result);
        printResult(result);
        await sleep(500);
    }

    // ═══════════════════════════════════════════════════════════
    // Summary
    // ═══════════════════════════════════════════════════════════
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("                      SUMMARY");
    console.log("═══════════════════════════════════════════════════════════\n");

    const successful = results.filter(r => r.status === "SUCCESS").length;
    const failed = results.filter(r => r.status === "FAILED").length;
    const rateLimited = results.filter(r => r.status === "RATE_LIMITED").length;

    console.log(`✅ Successful:    ${successful}/${results.length}`);
    console.log(`❌ Failed:        ${failed}/${results.length}`);
    console.log(`⚠️  Rate Limited:  ${rateLimited}/${results.length}`);

    const avgResponseTime = results.reduce((acc, r) => acc + r.responseTime, 0) / results.length;
    console.log(`⏱️  Avg Response:  ${avgResponseTime.toFixed(0)}ms`);

    console.log("\n───────────────────────────────────────────────────────────");
    console.log("RECOMMENDATION:");

    if (failed === 0 && rateLimited === 0) {
        console.log("✅ All APIs operational. Proceed with Data-API as primary source.");
    } else if (rateLimited > 0) {
        console.log("⚠️  Rate limiting detected. Implement exponential backoff.");
    } else {
        console.log("❌ Some APIs failed. Consider Goldsky Subgraph as fallback.");
    }

    console.log("═══════════════════════════════════════════════════════════\n");
}

function printResult(result: APITestResult) {
    const statusIcon = result.status === "SUCCESS" ? "✅" :
        result.status === "RATE_LIMITED" ? "⚠️" : "❌";

    console.log(`  ${statusIcon} ${result.endpoint}`);
    console.log(`     Status: ${result.statusCode} | Time: ${result.responseTime}ms`);
    console.log(`     Data: ${result.dataShape}`);
    if (result.error) {
        console.log(`     Error: ${result.error}`);
    }
    console.log("");
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(console.error);
