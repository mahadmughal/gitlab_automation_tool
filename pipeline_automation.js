import { program } from "commander";
import fs from "fs/promises";
import path from "path";
import { chromium, firefox } from "playwright";

const SCRIPTS_PATH = "/Users/mahadasif/Desktop/wareef-scripts";

class GitLabPipelineAutomator {
  constructor() {
    this.browser = null;
    this.page = null;
    this.pipelineId = null;
  }

  async connectToExistingChrome() {
    try {
      this.browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
      const contexts = this.browser.contexts();
      this.page = await contexts[0].newPage();
      console.log("✅ Connected to existing Chrome session (new tab opened)");
      return true;
    } catch (err) {
      console.log("❌ Could not connect to Chrome:", err);
      console.log(
        "Start Chrome with: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222"
      );
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

  async retry(fn, maxAttempts = 3, delayMs = 5000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        console.log(`⚠️ Attempt ${attempt} failed: ${err.message || err}`);
        if (attempt < maxAttempts) {
          console.log(`🔄 Retrying in ${delayMs / 1000}s...`);
          await this.page.waitForTimeout(delayMs);
        } else {
          throw err;
        }
      }
    }
  }

  async navigateToGitlabPipeline() {
    const targetUrl =
      "https://devops.housing.sa:8083/ejar3/devs/ejar3-run-script-tool/-/pipelines/new";
    await this.page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    console.log("✅ GitLab pipeline page opened");
  }

  async selectBranch(branchName = "production") {
    console.log(`Selecting branch: ${branchName}`);
    await this.page.reload();
    await this.page.click(".ref-selector #dropdown-toggle-btn-37");
    await this.page.waitForSelector("#base-dropdown-38 ul");

    const liElements = await this.page.$$("#base-dropdown-38 ul li");
    let index = { development: 5, production: 7, test: 8, uat: 1 }[
      branchName.toLowerCase()
    ];
    if (index === undefined) throw new Error(`Invalid branch: ${branchName}`);

    await liElements[index].click();
    console.log(`✅ Branch '${branchName}' selected`);
  }

  async readScript(scriptName) {
    const scriptPath = path.join(SCRIPTS_PATH, `${scriptName}.rb`);
    return await fs.readFile(scriptPath, "utf8");
  }

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
    if (
      ejarService.toLowerCase().includes("sec") ||
      ejarService.toLowerCase().includes("security-deposit")
    ) {
      const extracted = this.fetchTicketDescriptionFromScript(scriptContent);
      if (extracted) {
        console.log(
          `🔄 Replacing ticket description '${ticketDescription}' with extracted '${extracted}'`
        );
        ticketDescription = extracted;
      }
    }

    await this.page.waitForSelector(
      'div[data-testid="ci-variable-row-container"]',
      { timeout: 15000 }
    );
    const containers = await this.page.$$(
      'div[data-testid="ci-variable-row-container"]'
    );
    if (!containers.length) throw new Error("No CI variable containers found");

    // 1. Ticket description
    const textarea1 = await containers[0].$(
      '[data-testid="pipeline-form-ci-variable-value-field"]'
    );
    await textarea1.fill(ticketDescription);

    // 2. Service dropdown
    const dropdownBtn = await containers[1].$(
      '[data-testid="pipeline-form-ci-variable-value-dropdown"]'
    );
    await dropdownBtn.click();
    await this.page.waitForSelector("#base-dropdown-54 #listbox-52");
    const options = await this.page.$$("#base-dropdown-54 #listbox-52 li");
    let matched = false;
    for (const opt of options) {
      const text = await opt.getAttribute("data-testid");
      if (text?.toLowerCase().includes(ejarService.toLowerCase())) {
        await opt.click();
        matched = true;
        break;
      }
    }
    if (!matched) await options[4].click();

    // 3. Script content
    const scriptArea = await containers[2].$(
      '[data-testid="pipeline-form-ci-variable-value-field"]'
    );
    await scriptArea.fill(scriptContent);

    await this.page.click('[data-testid="run-pipeline-button"]');
    console.log("✅ CI variables set and pipeline started");
  }

  async waitForPipelinePage() {
    await this.page.waitForURL(/\/pipelines\/\d+$/, { timeout: 30000 });
    this.pipelineId = this.page.url().split("/").pop();
    console.log(`✅ Pipeline page loaded (ID: ${this.pipelineId})`);
  }

  async approvePipelineStage() {
    return this.retry(
      async () => {
        console.log("⏳ Waiting for approve stage...");
        const maxAttempts = 20;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const badge = this.page.locator("#ci-badge-approve_prod");
            await badge.waitFor({ timeout: 15000 });

            const ciIcon = badge.getByTestId("ci-icon");
            const aria = await ciIcon.getAttribute("aria-label");

            console.log("aria value: ", aria);

            // const ciIcon = badge.locator('[data-testid="ci-icon"]');
            const iconClass = await ciIcon.getAttribute("class");
            const neutral = iconClass?.includes("ci-icon-variant-neutral");
            const success = iconClass?.includes("ci-icon-variant-success");

            console.log("iconClass: ", iconClass);

            if (success) {
              console.log("✅ Approve stage already completed");
              return true;
            }

            if (neutral) {
              console.log("🔘 Approve button available, clicking...");
              const approveButton = badge.locator(
                '[data-testid="ci-action-button"]'
              );
              await approveButton.scrollIntoViewIfNeeded();
              await approveButton.click();
              await this.page.waitForTimeout(2000);

              const updatedClass = await ciIcon.getAttribute("class");
              console.log("updated class: ", updatedClass);
              if (updatedClass?.includes("ci-icon-variant-success")) {
                console.log("✅ Successfully approved pipeline");
                return true;
              }
            } else {
              console.log("⏳ Approve stage in progress...");
            }
          } catch (err) {
            console.log(`⚠️ Error while approving: ${err}`);
          }

          await this.page.reload();
          console.log(`Retrying... (attempt ${attempt + 1}/${maxAttempts})`);
          await this.page.waitForTimeout(5000);
        }
        throw new Error("❌ Approve stage did not complete in time");
      },
      2,
      10000
    );
  }

  async runPipelineStage() {
    try {
      console.log("Looking for run pipeline badge...");
      const badge = this.page.locator("#ci-badge-runscript_prod");
      await badge.waitFor({ timeout: 10000 });
      console.log("✓ Found run pipeline badge");

      await badge.click();
      console.log("✓ Redirected to pipeline execution page");
    } catch (err) {
      console.log(`✗ Could not click run pipeline badge: ${err}`);
      return false;
    }

    await this.page.waitForTimeout(15000);

    try {
      console.log("Monitor the pipeline execution until completion");
      const maxAttempts = 60;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const ciIcon = this.page.locator(
            '.build-job a[data-testid="ci-icon"]'
          );
          await ciIcon.waitFor({ timeout: 5000 });

          const ariaLabel = await ciIcon.getAttribute("aria-label");
          if (ariaLabel?.includes("Status: Passed")) {
            console.log(
              `✅ Pipeline execution passed with pipeline_id: ${this.pipelineId}`
            );
            return true;
          }
          if (ariaLabel?.includes("Status: Failed")) {
            console.log("❌ Pipeline execution failed");
            return false;
          }
        } catch (err) {
          console.log(`⚠️ Could not find pipeline-status-link: ${err}`);
        }

        console.log(`⏳ Checking... (attempt ${attempt + 1}/${maxAttempts})`);
        await this.page.reload();
        await this.page.waitForTimeout(10000);
      }

      console.log("⚠️ Pipeline monitoring timed out");
      return false;
    } catch (err) {
      console.log(`💥 Error monitoring pipeline: ${err}`);
      return false;
    }
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
    .requiredOption("-t, --ticket <ticket>", "Ticket description")
    .requiredOption("-s, --script <script>", "Ruby script filename without .rb")
    .requiredOption("-e, --ejar-service <service>", "Ejar3 service name")
    .option("-b, --branch <branch>", "Git branch to use", "production");
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

    // Wrap the whole core flow in retry
    await automator.retry(
      async () => {
        await automator.navigateToGitlabPipeline();
        await automator.selectBranch(args.branch);
        const script = await automator.readScript(args.script);
        await automator.processCiVariables(
          args.ticket,
          script,
          args.ejarService
        );
        await automator.waitForPipelinePage();
      },
      3,
      1000
    );

    console.log("✅ Pipeline page loaded");
    console.log("⏳ Waiting for approve stage...");
    await automator.approvePipelineStage();

    console.log("🎉 Pipeline approved successfully");

    await automator.runPipelineStage();
  } catch (err) {
    console.error("💥 Automation failed:", err);
    process.exit(1);
  } finally {
    await automator.close();
  }
})();
