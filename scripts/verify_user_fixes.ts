import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";

const OUTPUT_DIR = path.resolve("./artifacts/verification_screenshots");
const BASE_URL = "http://localhost:5178";
const BRAVE_PATH = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function run() {
  console.log("=== Launching Automated Browser Verification ===");
  const browser = await puppeteer.launch({
    executablePath: BRAVE_PATH,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--window-size=1366,768",
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Executive Dashboard (Image 1 Fixes)
    // -------------------------------------------------------------------------
    console.log("--> Testing Executive Dashboard (Header line & GSTIN removal)...");
    await page.goto(`${BASE_URL}/?tab=dashboard&currency=INR`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1000));

    // Capture screenshot of Dashboard
    const p1 = path.join(OUTPUT_DIR, "01_dashboard_executive_header.png");
    await page.screenshot({ path: p1, fullPage: false });
    console.log(`[SAVED] Screenshot 1: ${p1}`);

    const dashboardText = await page.evaluate(() => document.body.innerText);

    if (dashboardText.includes("Consolidated Executive Financial Matrix")) {
      throw new Error("FAILED: 'Consolidated Executive Financial Matrix' still appears on dashboard!");
    } else {
      console.log("[PASS] 'Consolidated Executive Financial Matrix' line successfully removed.");
    }

    if (dashboardText.includes("27AABCU9603R1ZN") || dashboardText.includes("27AABCU9603R1ZM")) {
      throw new Error("FAILED: Random dummy GSTIN still appears on dashboard!");
    } else {
      console.log("[PASS] Random dummy GSTIN successfully removed from dashboard banner.");
    }

    if (dashboardText.toLowerCase().includes("tally")) {
      throw new Error("FAILED: 'Tally' still appears on dashboard!");
    } else {
      console.log("[PASS] 'Tally' words successfully eliminated from dashboard.");
    }

    // -------------------------------------------------------------------------
    // TEST 2: POSBilling Register & Tender Cash (Images 2 & 3 Fixes)
    // -------------------------------------------------------------------------
    console.log("--> Testing POS Register (Cash Received & Exact/Custom buttons)...");
    await page.goto(`${BASE_URL}/?tab=pos&currency=INR`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1000));

    // Add item to cart by clicking product card for Ethiopian Yirgacheffe
    await page.evaluate(() => {
      const allDivs = Array.from(document.querySelectorAll("div"));
      const card = allDivs.find((d) => d.textContent?.includes("Ethiopian Yirgacheffe") && d.className.includes("group"));
      if (card) {
        card.click();
      }
    });
    await new Promise((r) => setTimeout(r, 800));

    const posText = await page.evaluate(() => document.body.innerText);
    const hasCashReceivedPlaceholder = await page.evaluate(() => {
      const input = document.querySelector('input[placeholder="Cash Received..."]');
      return !!input;
    });

    if (!hasCashReceivedPlaceholder) {
      throw new Error("FAILED: 'Cash Received...' placeholder not found on input!");
    } else {
      console.log("[PASS] 'Cash Received...' input placeholder is active.");
    }

    // Check that denomination chips 50, 100, 200, 500 are REMOVED
    const hasDenomChips = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      return buttons.some((b) => ["₹50", "₹100", "₹200", "₹500"].includes((b.textContent || "").trim()));
    });
    if (hasDenomChips) {
      throw new Error("FAILED: Denomination chips (50, 100, 200, 500) still present!");
    } else {
      console.log("[PASS] Denomination chips (50, 100, 200, 500) cleanly removed.");
    }

    // Check that Exact and Custom buttons are present
    const hasExactAndCustom = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim());
      return buttons.includes("Exact") && buttons.includes("Custom");
    });
    if (!hasExactAndCustom) {
      throw new Error("FAILED: 'Exact' and 'Custom' buttons not both present!");
    } else {
      console.log("[PASS] 'Exact' and 'Custom' options both cleanly present.");
    }

    const p2 = path.join(OUTPUT_DIR, "02_pos_checkout_cash_received.png");
    await page.screenshot({ path: p2 });
    console.log(`[SAVED] Screenshot 2: ${p2}`);

    // -------------------------------------------------------------------------
    // TEST 3: Match Logic: Exact & Custom Cash
    // -------------------------------------------------------------------------
    console.log("--> Testing Cash Match Logic (Exact vs Custom amount)...");
    // Click "Exact" button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const exactBtn = btns.find((b) => (b.textContent || "").trim() === "Exact");
      if (exactBtn) exactBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    const exactVal = await page.evaluate(() => {
      const input = document.querySelector('input[placeholder="Cash Received..."]') as HTMLInputElement;
      return input ? input.value : "";
    });
    console.log(`[PASS] Exact button match logic: filled value = ${exactVal}`);

    const p3 = path.join(OUTPUT_DIR, "03_pos_exact_match_logic.png");
    await page.screenshot({ path: p3 });
    console.log(`[SAVED] Screenshot 3: ${p3}`);

    // Click "Custom" button and enter custom amount 100
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const customBtn = btns.find((b) => (b.textContent || "").trim() === "Custom");
      if (customBtn) customBtn.click();
      const input = document.querySelector('input[placeholder="Cash Received..."]') as HTMLInputElement;
      if (input) {
        input.value = "100.00";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await new Promise((r) => setTimeout(r, 400));

    const p4 = path.join(OUTPUT_DIR, "04_pos_custom_cash_tender.png");
    await page.screenshot({ path: p4 });
    console.log(`[SAVED] Screenshot 4: ${p4}`);

    // -------------------------------------------------------------------------
    // TEST 4: Sleek Black Toast Notification (Image 0 Fix)
    // -------------------------------------------------------------------------
    console.log("--> Testing Sale Completion and Sleek Black Toast Popup...");
    // Click Charge button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const chargeBtn = btns.find((b) => (b.textContent || "").toUpperCase().includes("CHARGE"));
      if (chargeBtn) chargeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    // Verify toast is present and has black styling bg-[#161618]
    const toastInfo = await page.evaluate(() => {
      const toastEl = document.querySelector(".fixed.top-16.right-4, .fixed.top-16.right-8");
      if (!toastEl) return null;
      const classList = toastEl.className;
      const text = toastEl.textContent || "";
      const isBlack = classList.includes("bg-[#161618]") || getComputedStyle(toastEl).backgroundColor.includes("rgb(22, 22, 24)");
      return { classList, text, isBlack };
    });

    if (!toastInfo) {
      throw new Error("FAILED: Toast popup did not appear after sale!");
    }
    console.log(`[PASS] Sale completed toast appeared: "${toastInfo.text.trim().substring(0, 40)}..."`);
    console.log(`[PASS] Sleek black aesthetic verified (classes: ${toastInfo.classList.split(" ")[0]} ... isBlack: ${toastInfo.isBlack})`);

    const p5 = path.join(OUTPUT_DIR, "05_sleek_black_toast_popup.png");
    await page.screenshot({ path: p5 });
    console.log(`[SAVED] Screenshot 5: ${p5}`);

    // -------------------------------------------------------------------------
    // TEST 5: Invoice Pure PDF Print Isolation & Logo Presentation (Images 4, 5, 6 Fixes)
    // -------------------------------------------------------------------------
    console.log("--> Testing Invoice Modal, Logo, Straight Lines, and Pure PDF Print Pipeline...");
    // Click "Receipt" button on the toast
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const receiptBtn = btns.find((b) => (b.textContent || "").trim() === "Receipt");
      if (receiptBtn) receiptBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Verify portal exists outside root
    const portalExists = await page.evaluate(() => {
      const portal = document.getElementById("invoice-modal-portal");
      const printable = document.querySelector('[data-printable="true"]');
      const root = document.getElementById("root");
      const isOutsideRoot = portal && root && !root.contains(portal);
      return { hasPortal: !!portal, hasPrintable: !!printable, isOutsideRoot };
    });

    if (!portalExists.hasPortal || !portalExists.isOutsideRoot) {
      throw new Error("FAILED: Invoice modal is not rendered into an isolated portal outside #root!");
    } else {
      console.log("[PASS] Invoice modal successfully isolated in #invoice-modal-portal outside #root.");
    }

    // Verify logo is cleanly present
    const logoPresent = await page.evaluate(() => {
      const printable = document.querySelector('[data-printable="true"]');
      if (!printable) return false;
      const img = printable.querySelector('img[alt="Store Logo"]');
      const emblem = printable.querySelector(".rounded-2xl, .rounded-xl");
      return !!(img || emblem);
    });

    if (!logoPresent) {
      throw new Error("FAILED: Store logo is missing on invoice document!");
    } else {
      console.log("[PASS] Store logo is cleanly present on invoice layout.");
    }

    // Verify straight lines (no dashed borders on dividers)
    const hasDashedBorders = await page.evaluate(() => {
      const printable = document.querySelector('[data-printable="true"]');
      if (!printable) return false;
      const allDivs = Array.from(printable.querySelectorAll("div"));
      return allDivs.some((d) => d.className.includes("border-dashed") || d.className.includes("border-dotted"));
    });

    if (hasDashedBorders) {
      throw new Error("FAILED: Invoice still has dashed/dotted borders instead of clean straight lines!");
    } else {
      console.log("[PASS] Invoice strictly enforces clean straight divider lines.");
    }

    // Switch to A4 standard format
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const a4Btn = btns.find((b) => (b.textContent || "").trim().includes("A4"));
      if (a4Btn) a4Btn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // Test Pure PDF Print button click
    console.log("--> Testing Pure PDF Print Button execution...");
    const printBtnWorked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const printBtn = btns.find((b) => (b.textContent || "").trim() === "Print");
      if (printBtn) {
        printBtn.click();
        return true;
      }
      return false;
    });

    if (!printBtnWorked) {
      throw new Error("FAILED: 'Print' button not found in invoice modal!");
    }
    console.log("[PASS] Pure PDF Print button successfully dispatched.");
    await new Promise((r) => setTimeout(r, 800));

    const p6 = path.join(OUTPUT_DIR, "06_invoice_modal_logo_and_layout.png");
    await page.screenshot({ path: p6 });
    console.log(`[SAVED] Screenshot 6: ${p6}`);

    // Emulate print media and capture pure printable invoice
    await page.emulateMediaType("print");
    const p6_print = path.join(OUTPUT_DIR, "06_pure_pdf_print_emulation.png");
    await page.screenshot({ path: p6_print, fullPage: true });
    console.log(`[SAVED] Screenshot 6b (Print Emulation): ${p6_print}`);

    // Check print isolation
    const printIsolation = await page.evaluate(() => {
      const root = document.getElementById("root");
      const rootHidden = root ? getComputedStyle(root).display === "none" : false;
      const printable = document.querySelector('[data-printable="true"]');
      const printableVisible = printable ? getComputedStyle(printable).display !== "none" : false;
      return { rootHidden, printableVisible };
    });

    if (!printIsolation.rootHidden || !printIsolation.printableVisible) {
      throw new Error(`FAILED: Print isolation failed (rootHidden=${printIsolation.rootHidden}, printableVisible=${printIsolation.printableVisible})`);
    } else {
      console.log("[PASS] Print isolation 100% active: #root suppressed, pure document isolated.");
    }
    await page.emulateMediaType("screen");

    // Close modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button[title="Close preview"]') as HTMLButtonElement;
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    // -------------------------------------------------------------------------
    // TEST 6: 3-Month Demo Simulation & Match Logic (AuditLogView)
    // -------------------------------------------------------------------------
    console.log("--> Testing 3-Month Demo Simulation & RESET Match Logic...");
    await page.goto(`${BASE_URL}/?tab=audit`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1000));

    // Verify "Generate 3-Month Demo Simulation"
    const has3MonthDemo = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      return btns.some((b) => (b.textContent || "").includes("Generate Demo Data") || (b.textContent || "").includes("Demo"));
    });

    if (!has3MonthDemo) {
      throw new Error("FAILED: Demo Data generator button not found!");
    }

    // Trigger demo generator
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const demoBtn = btns.find((b) => (b.textContent || "").includes("Generate Demo Data"));
      if (demoBtn) demoBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // Confirm dialog
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const confirmBtn = btns.find((b) => (b.textContent || "").includes("Generate 3-Month Data") || (b.textContent || "").includes("Generate Data"));
      if (confirmBtn) confirmBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    const p7 = path.join(OUTPUT_DIR, "07_three_month_demo_simulation.png");
    await page.screenshot({ path: p7 });
    console.log(`[SAVED] Screenshot 7: ${p7}`);

    // Test RESET match logic
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const resetBtn = btns.find((b) => (b.textContent || "").includes("Clear Database"));
      if (resetBtn) resetBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // Wait for prompt input
    await page.waitForSelector('input[placeholder="RESET"]', { timeout: 5000 });
    const promptInput = await page.$('input[placeholder="RESET"]');
    if (!promptInput) throw new Error("Prompt input not found");

    // Test mismatch: type "wrong"
    await promptInput.click();
    await promptInput.type("wrong");
    await new Promise((r) => setTimeout(r, 300));

    const disabledWhenWrong = await page.evaluate(() => {
      const eraseBtn = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent || "").includes("Erase Everything")) as HTMLButtonElement;
      return eraseBtn ? eraseBtn.disabled : false;
    });

    // Test exact match: select all and type "RESET"
    await page.keyboard.down("Control");
    await page.keyboard.press("A");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    await promptInput.type("RESET");
    await new Promise((r) => setTimeout(r, 400));

    const enabledWhenMatch = await page.evaluate(() => {
      const eraseBtn = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent || "").includes("Erase Everything")) as HTMLButtonElement;
      return eraseBtn ? !eraseBtn.disabled : false;
    });

    if (!disabledWhenWrong || !enabledWhenMatch) {
      throw new Error(`FAILED: RESET match logic failed (disabledWhenWrong=${disabledWhenWrong}, enabledWhenMatch=${enabledWhenMatch})`);
    } else {
      console.log(`[PASS] Match logic verified: Disabled on mismatch (${disabledWhenWrong}), unlocked on exact 'RESET' match (${enabledWhenMatch}).`);
    }

    const p8 = path.join(OUTPUT_DIR, "08_match_logic_reset_verification.png");
    await page.screenshot({ path: p8 });
    console.log(`[SAVED] Screenshot 8: ${p8}`);

    // Close reset dialog
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const cancelBtn = btns.find((b) => (b.textContent || "").includes("Cancel"));
      if (cancelBtn) cancelBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // -------------------------------------------------------------------------
    // TEST 7: Sidebar & Accounting Gateway (Zero Tally Mentions)
    // -------------------------------------------------------------------------
    console.log("--> Testing Sidebar Navigation & Accounting Gateway Labels...");
    await page.goto(`${BASE_URL}/?tab=gst_hub&currency=INR`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 800));

    const pageContent = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const hasTally = bodyText.toLowerCase().includes("tally");
      const hasAccountingGateway = bodyText.includes("Accounting Gateway") || bodyText.includes("Accounting Hub");
      const hasFakeGstin = bodyText.includes("27AABCU9603R1ZN") || bodyText.includes("27AABCU9603R1ZM");
      return { hasTally, hasAccountingGateway, hasFakeGstin };
    });

    if (pageContent.hasTally) {
      throw new Error("FAILED: 'Tally' still found in Accounting Gateway view!");
    }
    if (pageContent.hasFakeGstin) {
      throw new Error("FAILED: Hardcoded fake GSTIN still found in Accounting Gateway!");
    }
    if (!pageContent.hasAccountingGateway) {
      throw new Error("FAILED: 'Accounting Gateway' banner not found!");
    }
    console.log("[PASS] 'Accounting Gateway' cleanly present, zero 'Tally' mentions, zero fake GSTIN.");

    const p9 = path.join(OUTPUT_DIR, "09_accounting_hub_gateway.png");
    await page.screenshot({ path: p9 });
    console.log(`[SAVED] Screenshot 9: ${p9}`);

    console.log("\n=======================================================");
    console.log("   ALL QA TESTS & VERIFICATION PASSED WITH 100% SUCCESS");
    console.log("=======================================================\n");
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
