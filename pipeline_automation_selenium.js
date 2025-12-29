const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const firefox = require('selenium-webdriver/firefox');
const fs = require('fs').promises;
const path = require('path');
const { program } = require('commander');

const SCRIPTS_PATH = "/Users/mahadasif/Desktop/wareef-scripts";
const GITLAB_BASE_URL = "https://devops.nhc.sa";

class GitLabPipelineAutomator {
  constructor() {
    this.driver = null;
    this.pipelineId = null;
  }

  async connectToExistingFirefox() {
    try {
      const options = new firefox.Options();
      options.addArguments("--new-instance");

      this.driver = await new Builder()
        .forBrowser("firefox")
        .setFirefoxOptions(options)
        .build();

      console.log("Successfully connected to Firefox browser");
      return true;
    } catch (error) {
      console.log(`Could not connect to Firefox: ${error}`);
      return false;
    }
  }

  async connectToExistingChrome() {
    try {
      const options = new chrome.Options();
      options.debuggerAddress("127.0.0.1:9222");

      this.driver = await new Builder()
        .forBrowser("chrome")
        .setChromeOptions(options)
        .build();

      console.log("Successfully connected to existing Chrome browser");
      return true;
    } catch (error) {
      console.log(`Could not connect to existing Chrome: ${error}`);
      console.log(
        "Please start Chrome with: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222"
      );
      return false;
    }
  }

  async reloadPage() {
    try {
      await this.driver.navigate().refresh();
      await this.driver.wait(until.elementLocated(By.tagName("body")), 10000);
      console.log("✅ Page reloaded successfully");
    } catch (error) {
      console.log(`❌ Error while safe reload: ${error}`);
      try {
        const currentUrl = await this.driver.getCurrentUrl();
        await this.driver.get(currentUrl);
        await this.driver.wait(until.elementLocated(By.tagName("body")), 10000);
        console.log("✅ Used fallback reload method");
      } catch (fallbackError) {
        console.log(`❌ Fallback reload also failed: ${fallbackError}`);
        return false;
      }
    }
  }

  async navigateToGitlabPipeline() {
    const targetUrl = `${GITLAB_BASE_URL}/ejar3/devs/ejar3-run-script-tool/-/pipelines/new`;

    try {
      const currentUrl = await this.driver.getCurrentUrl();
      if (!currentUrl.includes(targetUrl)) {
        console.log(`Navigating to: ${targetUrl}`);
        await this.driver.get(targetUrl);
        await this.driver.wait(until.elementLocated(By.tagName("body")), 10000);
        await this.sleep(2000);
      }

      console.log("GitLab pipeline page is now active");
      return true;
    } catch (error) {
      console.log(`Error navigating to GitLab: ${error}`);
      return false;
    }
  }

  async selectBranch(branchName = "production") {
    console.log(`Attempting to select branch: ${branchName}`);

    try {
      const pipelineUrl = `${GITLAB_BASE_URL}/ejar3/devs/ejar3-run-script-tool/-/pipelines/new`;

      await this.driver.get(pipelineUrl);
      await this.reloadPage();

      await this.driver.wait(
        until.elementLocated(By.tagName("fieldset")),
        10000
      );

      console.log("Navigating to GitLab pipeline page...");
      await this.driver.get(pipelineUrl);

      const refSelectorDiv = await this.driver.wait(
        until.elementLocated(By.className("ref-selector")),
        10000
      );

      const dropdownButton = await refSelectorDiv.findElement(
        By.id("dropdown-toggle-btn-34")
      );
      await dropdownButton.click();

      const baseDropdownDiv = await this.driver.wait(
        until.elementLocated(By.id("base-dropdown-36")),
        10000
      );

      await this.sleep(1000);

      const ulElement = await baseDropdownDiv.findElement(By.tagName("ul"));

      let index;
      switch (branchName.toLowerCase()) {
        case "development":
          index = 4;
          break;
        case "production":
          index = 5;
          break;
        case "test":
          index = 6;
          break;
        case "uat":
          index = 7;
          break;
        default:
          throw new Error(`Invalid branch name: ${branchName}`);
      }

      const liElements = await ulElement.findElements(By.tagName("li"));
      await liElements[index].click();
      await this.sleep(2000);

      console.log(`Successfully selected branch: ${branchName}`);
      return true;
    } catch (error) {
      console.log(`Error selecting branch: ${error}`);
      console.log("Retrying...");
      return await this.selectBranch(branchName);
    }
  }

  async readScript(scriptName) {
    try {
      const scriptPath = path.join(SCRIPTS_PATH, `${scriptName}.rb`);
      const script = await fs.readFile(scriptPath, "utf8");
      return script;
    } catch (error) {
      console.log(`Error reading ruby script: ${error}`);
      return null;
    }
  }

  fetchTicketDescriptionFromScript(scriptContent) {
    try {
      console.log("🔍 Extracting ticket description from script content...");

      const pattern = /task\s+([a-zA-Z0-9_]+)\s*:\s*:environment\s+do/;
      const match = scriptContent.match(pattern);

      if (match) {
        const taskName = match[1];
        console.log(`✓ Extracted ticket description: '${taskName}'`);
        return taskName;
      } else {
        console.log("✗ No task name found in script content");
        return null;
      }
    } catch (error) {
      console.log(`✗ Error extracting ticket description: ${error}`);
      return null;
    }
  }

  async processCiVariables(ticketDescription, script, ejarService) {
    try {
      console.log("Processing CI variables...");
      console.log(`Ticket Description: ${ticketDescription}`);
      console.log(`Script: ${script}`);
      console.log(`Ejar Service: ${ejarService}`);

      const ciVariableRowContainers = await this.driver.wait(
        until.elementsLocated(
          By.css('div[data-testid="ci-variable-row-container"]')
        ),
        10000
      );

      if (ejarService.toLowerCase().includes("sec")) {
        console.log(
          "🔍 'sec' keyword detected in ejar_service - extracting ticket description from script..."
        );

        const extractedDescription =
          this.fetchTicketDescriptionFromScript(script);

        if (extractedDescription) {
          ticketDescription = extractedDescription;
          console.log(
            `✓ Updated ticket description to: '${ticketDescription}'`
          );
        } else {
          console.log(
            "⚠️ Could not extract ticket description, using original ticket description"
          );
        }
      }

      console.log("Setting ticket description in first container...");
      const firstContainer = ciVariableRowContainers[0];
      const textarea = await firstContainer.findElement(
        By.css('[data-testid="pipeline-form-ci-variable-value-field"]')
      );
      await textarea.clear();
      await textarea.sendKeys(ticketDescription);
      console.log(`✓ Set ticket description: '${ticketDescription}'`);

      console.log("Selecting ejar3 service in second container...");
      const secondContainer = ciVariableRowContainers[1];
      const dropdownBtn = await secondContainer.findElement(
        By.css('[data-testid="pipeline-form-ci-variable-value-dropdown"]')
      );
      await dropdownBtn.click();
      await this.sleep(1000);

      const dropdownDiv = await this.driver.wait(
        until.elementLocated(By.id("base-dropdown-59")),
        10000
      );

      const listboxUl = await dropdownDiv.findElement(By.id("listbox-58"));
      const serviceOptions = await listboxUl.findElements(By.tagName("li"));
      let serviceSelected = false;

      for (const option of serviceOptions) {
        const optionText = await option.getAttribute("data-testid");
        if (
          optionText &&
          optionText.toLowerCase().includes(ejarService.toLowerCase())
        ) {
          await option.click();
          serviceSelected = true;
          console.log(
            `✓ Selected service: '${optionText.replace("listbox-item-", "")}'`
          );
          break;
        }
      }

      if (!serviceSelected) {
        console.log(
          `✗ Service '${ejarService}' not found, using default (5th option)`
        );
        await serviceOptions[4].click();
      }

      await this.sleep(1000);

      console.log("Setting script name in third container...");
      const thirdContainer = ciVariableRowContainers[2];
      const scriptTextarea = await thirdContainer.findElement(
        By.css('[data-testid="pipeline-form-ci-variable-value-field"]')
      );
      await scriptTextarea.clear();
      await scriptTextarea.sendKeys(script);
      console.log(`✓ Set script content (length: ${script.length} characters)`);

      await this.driver.executeScript(
        "window.scrollTo(0, document.body.scrollHeight - 500);"
      );
      await this.sleep(1000);

      console.log("Clicking the Run Pipeline button...");
      const runPipelineButton = await this.driver.wait(
        until.elementLocated(By.css('[data-testid="run-pipeline-button"]')),
        10000
      );
      await runPipelineButton.click();

      console.log("Successfully processed CI variables and started pipeline");
      return true;
    } catch (error) {
      console.log(`Error processing CI variables: ${error}`);
      return false;
    }
  }

  async waitForPipelinePage() {
    try {
      console.log("Waiting for pipeline page to load...");

      const pipelinePathPrefix = `${GITLAB_BASE_URL}/ejar3/devs/ejar3-run-script-tool/-/pipelines/`;

      const pipelinePageLoaded = async (driver) => {
        const currentUrl = await driver.getCurrentUrl();
        console.log(`Current URL: ${currentUrl}`);
        return currentUrl.startsWith(pipelinePathPrefix);
      };

      try {
        await this.driver.wait(pipelinePageLoaded, 30000);
        console.log("✓ Pipeline page loaded successfully");
        return true;
      } catch (error) {
        console.log(
          `⚠️ Timeout waiting for pipeline page, continuing anyway: ${error}`
        );
        return true;
      }
    } catch (error) {
      console.log(`Error waiting for pipeline page: ${error}`);
      return false;
    }
  }

  async requestPipeline() {
    try {
      console.log("Looking for request_prod badge...");

      let ciBadgeRequestProdDiv;
      try {
        ciBadgeRequestProdDiv = await this.driver.wait(
          until.elementLocated(By.id("ci-badge-request_prod")),
          20000
        );
        console.log("✓ Found request_prod badge");
      } catch (error) {
        console.log(`✗ Could not find request_prod badge: ${error}`);
        console.log("Trying alternative selectors...");
        try {
          ciBadgeRequestProdDiv = await this.driver.wait(
            until.elementLocated(By.css('[id*="ci-badge-request"]')),
            10000
          );
          console.log("✓ Found alternative request badge");
        } catch (altError) {
          console.log(`✗ No request badge found: ${altError}`);
          return false;
        }
      }

      const currentUrl = await this.driver.getCurrentUrl();
      console.log(`Current URL: ${currentUrl}`);
      this.pipelineId = currentUrl.split("/").pop();

      console.log("Monitoring request stage completion...");
      const maxAttempts = 10;
      let attempt = 0;

      while (attempt < maxAttempts) {
        try {
          ciBadgeRequestProdDiv = await this.driver.wait(
            until.elementLocated(By.css('[id*="ci-badge-request"]')),
            10000
          );

          const ciIcon = await ciBadgeRequestProdDiv.findElement(
            By.css('[data-testid="ci-icon"]')
          );
          const iconClass = await ciIcon.getAttribute("class");

          console.log(
            `Attempt ${attempt + 1}: Request stage status - ${iconClass}`
          );

          if (iconClass.includes("ci-icon-variant-success")) {
            console.log("✓ Request stage completed successfully!");
            return true;
          } else if (
            iconClass.includes("ci-icon-variant-failed") ||
            iconClass.includes("ci-icon-variant-error")
          ) {
            console.log("✗ Request stage failed!");
            return false;
          } else {
            console.log(
              "⏳ Request stage still in progress so try reload page..."
            );
            await this.reloadPage();
          }
        } catch (error) {
          console.log(`⚠️ Error checking request stage status: ${error}`);
          console.log("Refreshing page and retrying...");
          await this.reloadPage();
        }

        attempt++;
        if (attempt < maxAttempts) {
          await this.reloadPage();
          console.log(`⏳ Checking... (attempt ${attempt}/${maxAttempts})`);
          await this.sleep(5000);
        }
      }

      console.log("⚠️ Request stage monitoring timed out");
      return false;
    } catch (error) {
      console.log(`Error in request pipeline stage: ${error}`);
      return false;
    }
  }

  async approvePipelineStage() {
    try {
      const maxAttempts = 20;
      let attempt = 0;

      while (attempt < maxAttempts) {
        try {
          const ciBadgeApproveProdDiv = await this.driver.wait(
            until.elementLocated(By.id("ci-badge-approve_prod")),
            20000
          );
          const ciIcon = await ciBadgeApproveProdDiv.findElement(
            By.css('[data-testid="ci-icon"]')
          );
          const iconClass = await ciIcon.getAttribute("class");
          const neutralCiIcon = iconClass.includes("badge-neutral");

          if (neutralCiIcon) {
            const approveButton = await ciBadgeApproveProdDiv.findElement(
              By.css('[data-testid="ci-action-button"]')
            );
            await this.driver.executeScript(
              "arguments[0].scrollIntoView(true);",
              approveButton
            );
            await this.sleep(2000);
            await approveButton.click();
            await this.sleep(2000);

            const updatedDiv = await this.driver.findElement(
              By.id("ci-badge-approve_prod")
            );
            const updatedIcon = await updatedDiv.findElement(
              By.css('[data-testid="ci-icon"]')
            );
            const updatedClass = await updatedIcon.getAttribute("class");
            const stillNeutral = updatedClass.includes("badge-neutral");

            if (stillNeutral) {
              console.log("⚠️ CI icon still has neutral class, retrying...");
              attempt++;
              continue;
            }

            console.log("✓ Successfully clicked approve button");
            await this.sleep(5000);
            console.log("⏳ Approve stage in progress...");

            let approveAttempt = 0;
            while (approveAttempt < maxAttempts) {
              const approveDiv = await this.driver.findElement(
                By.id("ci-badge-approve_prod")
              );
              const approveIcon = await approveDiv.findElement(
                By.css('[data-testid="ci-icon"]')
              );
              const approveClass = await approveIcon.getAttribute("class");

              console.log("ci_icon: ", approveClass);

              const successCiIcon = approveClass.includes("badge-success");
              console.log("success_ci_icon: ", successCiIcon);

              if (successCiIcon) {
                console.log("✓ Approve stage completed successfully!");
                return true;
              } else {
                console.log(
                  "✗ Approve stage still in progress so try reload page..."
                );
                await this.reloadPage();
                console.log(
                  `⏳ Checking... (attempt ${approveAttempt}/${maxAttempts})`
                );
                await this.sleep(5000);
              }
              approveAttempt++;
            }
          }
        } catch (error) {
          console.log("✗ Could not click approve button in exception block");
        }

        attempt++;
        if (attempt < maxAttempts) {
          await this.reloadPage();
          console.log(`⏳ Checking... (attempt ${attempt}/${maxAttempts})`);
          await this.sleep(5000);
        } else {
          console.log("✗ Could not click approve button");
          return false;
        }
      }
    } catch (error) {
      console.log(`Error in approve pipeline stage: ${error}`);
      return false;
    }
  }

  async runPipelineStage() {
    try {
      console.log("Looking for run pipeline badge...");
      const ciBadgeRunscriptProdDiv = await this.driver.wait(
        until.elementLocated(By.id("ci-badge-runscript_prod")),
        10000
      );
      console.log("✓ Found run pipeline badge");

      await ciBadgeRunscriptProdDiv.click();
      console.log("✓ Redirected to pipeline execution page");
    } catch (error) {
      console.log(`✗ Could not click run pipeline badge: ${error}`);
      return false;
    }

    await this.sleep(15000);

    try {
      console.log("Monitor the pipeline execution until completion");
      const maxAttempts = 60;
      let attempt = 0;

      while (attempt < maxAttempts) {
        try {
          const ci_icon = await this.driver.findElement(
            By.css('.build-job a[data-testid="ci-icon"]')
          );

          const ariaLabel = await ci_icon.getAttribute("aria-label");

          if (ariaLabel && ariaLabel.includes("Status: Passed")) {
            console.log(
              `Pipeline execution passed with pipeline_id: ${this.pipelineId}`
            );
            return true;
          }

          if (ariaLabel && ariaLabel.includes("Status: Failed")) {
            console.log("Pipeline execution failed");
            return false;
          }
        } catch (error) {
          console.log(`✗ Could not find pipeline-status-link: ${error}`);
        }

        attempt++;

        if (attempt < maxAttempts) {
          await this.reloadPage();
          console.log(`⏳ Checking... (attempt ${attempt}/${maxAttempts})`);
          await this.sleep(10000);
        }
      }

      console.log("⚠️ Pipeline monitoring timed out");
      return false;
    } catch (error) {
      console.log(`💥 Error monitoring pipeline: ${error}`);
      return false;
    }
  }

  async executePipeline() {
    try {
      if (!(await this.waitForPipelinePage())) {
        console.log("❌ Failed to load pipeline page");
        return false;
      }

      if (!(await this.requestPipeline())) {
        console.log("❌ Failed at request pipeline stage");
        return false;
      }

      if (!(await this.approvePipelineStage())) {
        console.log("❌ Failed at approval pipeline stage");
        return false;
      }

      if (!(await this.runPipelineStage())) {
        console.log("❌ Failed at run pipeline stage");
        return false;
      }

      console.log("=".repeat(60));
      console.log("✅ Pipeline approval process completed successfully!");
      return true;
    } catch (error) {
      console.log(`💥 Error in pipeline approval orchestrator: ${error}`);

      try {
        const currentUrl = await this.driver.getCurrentUrl();
        const pageTitle = await this.driver.getTitle();
        console.log(`Current URL: ${currentUrl}`);
        console.log(`Page title: ${pageTitle}`);
      } catch (debugError) {
        // Ignore debug errors
      }

      return false;
    }
  }

  async runAutomation(
    branchName = "production",
    ticketDescription = "",
    script = "",
    ejarService = ""
  ) {
    try {
      if (!ticketDescription || !script || !ejarService) {
        console.log(
          "Error: All parameters (ticket_description, script, ejar_service) are required"
        );
        return false;
      }

      if (!(await this.connectToExistingChrome())) {
        if (!(await this.connectToExistingFirefox())) {
          console.log("Could not connect to any existing browser");
          return false;
        }
      }

      if (!(await this.navigateToGitlabPipeline())) {
        return false;
      }

      if (!(await this.selectBranch(branchName))) {
        return false;
      }

      const scriptContent = await this.readScript(script);
      if (!scriptContent) {
        console.log("Error reading script");
        return false;
      }

      if (
        !(await this.processCiVariables(
          ticketDescription,
          scriptContent,
          ejarService
        ))
      ) {
        console.log("Error processing CI variables");
        return false;
      }

      if (!(await this.executePipeline())) {
        console.log("Error executing pipeline");
        return false;
      }

      return true;
    } catch (error) {
      console.log(`Error in automation: ${error}`);
      return false;
    }
  }

  async close() {
    if (this.driver) {
      console.log("Closing browser...");
      await this.driver.quit();
      this.driver = null;
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

function parseArguments() {
    program
        .name('pipeline-automation')
        .description('GitLab Pipeline Automation Script')
        .version('1.0.0')
        .requiredOption('-t, --ticket <ticket>', 'Ticket description (e.g., "ES-3456") - will be auto-updated for sec services')
        .requiredOption('-s, --script <script>', 'Ruby script filename without .rb extension (e.g., "check_user_eligibility")')
        .requiredOption('-e, --ejar-service <service>', 'Ejar3 service name (e.g., "ejar3-core-app", "ejar3-sec")')
        .option('-b, --branch <branch>', 'Git branch to use', 'production');

    program.parse();
    return program.opts();
}

// Main execution
async function main() {
    try {
        const args = parseArguments();

        console.log("=".repeat(60));
        console.log("GitLab Pipeline Automation");
        console.log("=".repeat(60));
        console.log(`Ticket Description: ${args.ticket}`);
        console.log(`Script: ${args.script}`);
        console.log(`Ejar Service: ${args.ejarService}`);
        console.log(`Branch: ${args.branch}`);

        if (args.ejarService.toLowerCase().includes("sec")) {
            console.log("🔍 SEC service detected - will extract task name from script!");
        }

        console.log("=".repeat(60));

        const automator = new GitLabPipelineAutomator();

        try {
            const success = await automator.runAutomation(
                args.branch,
                args.ticket,
                args.script,
                args.ejarService
            );

            if (success) {
                process.exit(0);
            } else {
                process.exit(1);
            }
        } finally {
            await automator.close();
        }
    } catch (error) {
        console.log(`\n💥 Unexpected error: ${error}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error(`Fatal error: ${error}`);
        process.exit(1);
    });
}

module.exports = GitLabPipelineAutomator;
