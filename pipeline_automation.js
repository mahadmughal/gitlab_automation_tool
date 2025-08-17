import { chromium, firefox } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { program } from 'commander';

const SCRIPTS_PATH = "/Users/mahadasif/Desktop/wareef-scripts";

class GitLabPipelineAutomator {
  constructor() {
    this.browser = null;
    this.page = null;
    this.pipelineId = null;
  }

  async connectToExistingChrome() {
    try {
      this.browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
      const contexts = this.browser.contexts();
  
      // ✅ Always create a new tab
      this.page = await contexts[0].newPage();
  
      console.log("✅ Connected to existing Chrome session (new tab opened)");
      return true;
    } catch (err) {
      console.log("❌ Could not connect to Chrome:", err);
      console.log("Start Chrome with: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222");
      return false;
    }
  }
  

  async connectToFirefox() {
    try {
      this.browser = await firefox.launch({ headless: false });
      this.page = await this.browser.newPage();
      console.log("✅ Connected to Firefox browser");
      return true;
    } catch (err) {
      console.log("❌ Could not connect to Firefox:", err);
      return false;
    }
  }

  async navigateToGitlabPipeline() {
    const targetUrl = "https://devops.housing.sa:8083/ejar3/devs/ejar3-run-script-tool/-/pipelines/new";
    await this.page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    console.log("✅ GitLab pipeline page opened");
  }

  async selectBranch(branchName = "production") {
    console.log(`Selecting branch: ${branchName}`);
    await this.page.reload();
    await this.page.click('.ref-selector #dropdown-toggle-btn-34');
    await this.page.waitForSelector('#base-dropdown-36 ul');

    const liElements = await this.page.$$('#base-dropdown-36 ul li');
    let index = { development: 4, production: 5, test: 6, uat: 7 }[branchName.toLowerCase()];
    if (index === undefined) throw new Error(`Invalid branch: ${branchName}`);

    await liElements[index].click();
    console.log(`✅ Branch '${branchName}' selected`);
  }

  async readScript(scriptName) {
    const scriptPath = path.join(SCRIPTS_PATH, `${scriptName}.rb`);
    return await fs.readFile(scriptPath, 'utf8');
  }

  // helper to extract task_name from ruby script
  fetchTicketDescriptionFromScript(scriptContent) {
    const pattern = /task\s+([a-zA-Z0-9_]+)\s*:\s*:environment\s+do/;
    const match = scriptContent.match(pattern);
    if (match) {
      console.log(`✓ Extracted task name from script: ${match[1]}`);
      return match[1];
    }
    console.log("⚠️ No task name found in script");
    return null;
  }

  async processCiVariables(ticketDescription, scriptContent, ejarService) {
    // 🔍 if service is sec/security-deposit, override ticket description
    if (
      ejarService.toLowerCase().includes("sec") ||
      ejarService.toLowerCase().includes("security-deposit")
    ) {
      const extracted = this.fetchTicketDescriptionFromScript(scriptContent);
      if (extracted) {
        console.log(`🔄 Replacing ticket description '${ticketDescription}' with extracted '${extracted}'`);
        ticketDescription = extracted;
      } else {
        console.log("⚠️ Could not extract task name, using provided ticket description");
      }
    }

    await this.page.waitForSelector('div[data-testid="ci-variable-row-container"]', { timeout: 15000 });
    const containers = await this.page.$$('div[data-testid="ci-variable-row-container"]');
    if (!containers.length) throw new Error("No CI variable containers found");

    // 1. Ticket description
    const textarea1 = await containers[0].$('[data-testid="pipeline-form-ci-variable-value-field"]');
    await textarea1.fill(ticketDescription);

    // 2. Service dropdown
    const dropdownBtn = await containers[1].$('[data-testid="pipeline-form-ci-variable-value-dropdown"]');
    await dropdownBtn.click();
    await this.page.waitForSelector('#base-dropdown-59 #listbox-58');
    const options = await this.page.$$('#base-dropdown-59 #listbox-58 li');
    let matched = false;
    for (const opt of options) {
      const text = await opt.getAttribute('data-testid');
      if (text?.toLowerCase().includes(ejarService.toLowerCase())) {
        await opt.click();
        matched = true;
        break;
      }
    }
    if (!matched) await options[4].click(); // fallback

    // 3. Script content
    const scriptArea = await containers[2].$('[data-testid="pipeline-form-ci-variable-value-field"]');
    await scriptArea.fill(scriptContent);

    // Run pipeline
    await this.page.click('[data-testid="run-pipeline-button"]');
    console.log("✅ CI variables set and pipeline started");
  }

  async waitForPipelinePage() {
    await this.page.waitForURL(/\/pipelines\/\d+$/, { timeout: 30000 });
    this.pipelineId = this.page.url().split('/').pop();
    console.log(`✅ Pipeline page loaded (ID: ${this.pipelineId})`);
  }

  async approvePipelineStage() {
    console.log("⏳ Waiting for approve stage...");

    const maxAttempts = 20;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Wait for approve badge
        const badge = this.page.locator('#ci-badge-approve_prod');
        await badge.waitFor({ timeout: 15000 });

        const ciIcon = badge.locator('[data-testid="ci-icon"]');
        const iconClass = await ciIcon.getAttribute('class');

        const neutral = iconClass?.includes('badge-neutral');
        const success = iconClass?.includes('badge-success');

        if (success) {
          console.log("✅ Approve stage already completed");
          return true;
        }

        if (neutral) {
          console.log("🔘 Approve button available, clicking...");
          const approveButton = badge.locator('[data-testid="ci-action-button"]');

          await approveButton.scrollIntoViewIfNeeded();
          await approveButton.click();
          await this.page.waitForTimeout(2000);

          // Re-check status
          const updatedClass = await ciIcon.getAttribute('class');
          if (!updatedClass?.includes('badge-neutral')) {
            console.log("✅ Successfully approved pipeline");
            return true;
          }

          console.log("⚠️ Approve still neutral, will retry...");
        } else {
          console.log("⏳ Approve stage in progress...");
        }
      } catch (err) {
        console.log(`⚠️ Error while approving: ${err}`);
      }

      // Retry loop
      await this.page.reload();
      console.log(`Retrying... (attempt ${attempt + 1}/${maxAttempts})`);
      await this.page.waitForTimeout(5000);
    }

    console.log("❌ Approve stage did not complete in time");
    return false;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log("Browser closed");
    }
  }
}

function parseArguments() {
  program
    .requiredOption('-t, --ticket <ticket>', 'Ticket description')
    .requiredOption('-s, --script <script>', 'Ruby script filename without .rb')
    .requiredOption('-e, --ejar-service <service>', 'Ejar3 service name')
    .option('-b, --branch <branch>', 'Git branch to use', 'production');
  program.parse();
  return program.opts();
}

(async () => {
  const args = parseArguments();
  const automator = new GitLabPipelineAutomator();

  try {
    if (!(await automator.connectToExistingChrome())) {
      await automator.connectToFirefox();
    }

    await automator.navigateToGitlabPipeline();
    await automator.selectBranch(args.branch);
    const script = await automator.readScript(args.script);
    await automator.processCiVariables(args.ticket, script, args.ejarService);
    await automator.waitForPipelinePage();

    console.log("✅ Pipeline page loaded");
    console.log("⏳ Waiting for approve stage...");
    await automator.approvePipelineStage();

    console.log("🎉 Pipeline approved successfully");
    process.exit(0);
  } catch (err) {
    console.error("💥 Automation failed:", err);
    process.exit(1);
  } finally {
    await automator.close();
  }
})();
