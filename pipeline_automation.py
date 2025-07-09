import time
import argparse
import sys
import re
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.firefox.options import Options

SCRIPTS_PATH = "/Users/mahadasif/Desktop/wareef-scripts"

class GitLabPipelineAutomator:
    def __init__(self):
        self.driver = None
        self.wait = None
        self.pipeline_id = None

    def connect_to_existing_firefox(self):
        """Connect to Firefox - will reuse existing profile but may open new window"""
        try:
            # Firefox options
            options = Options()
            # Use existing profile to maintain session
            options.add_argument("--new-instance")

            self.driver = webdriver.Firefox(options=options)
            self.wait = WebDriverWait(self.driver, 10)
            print("Successfully connected to Firefox browser")
            return True

        except Exception as e:
            print(f"Could not connect to Firefox: {e}")
            return False

    def connect_to_existing_chrome(self):
        """Connect to existing Chrome browser with remote debugging"""
        try:
            from selenium.webdriver.chrome.options import Options as ChromeOptions

            chrome_options = ChromeOptions()
            chrome_options.add_experimental_option("debuggerAddress", "127.0.0.1:9222")

            self.driver = webdriver.Chrome(options=chrome_options)
            self.wait = WebDriverWait(self.driver, 10)
            print("Successfully connected to existing Chrome browser")
            return True

        except Exception as e:
            print(f"Could not connect to existing Chrome: {e}")
            print("Please start Chrome with: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222")
            return False
          
    def reload_page(self):
        try:
            self.driver.refresh()
            # Wait for page to be fully loaded before printing success
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            print("✅ Page reloaded successfully")
        except Exception as e:
            print(f"❌ Error while safe reload: {e}")
            # Fallback method
            try:
                self.driver.get(self.driver.current_url)
                # Wait for fallback reload to complete
                WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.TAG_NAME, "body"))
                )
                print("✅ Used fallback reload method")
            except Exception as fallback_error:
                print(f"❌ Fallback reload also failed: {fallback_error}")
                return False

    def navigate_to_gitlab_pipeline(self):
        """Navigate to the GitLab pipeline page"""
        target_url = "https://devops.housing.sa:8083/ejar3/devs/ejar3-run-script-tool/-/pipelines/new"

        try:
            current_url = self.driver.current_url
            if target_url not in current_url:
                print(f"Navigating to: {target_url}")
                self.driver.get(target_url)

                # Wait for page to load
                self.wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
                time.sleep(2)

            print("GitLab pipeline page is now active")
            return True

        except Exception as e:
            print(f"Error navigating to GitLab: {e}")
            return False

    def select_branch(self, branch_name="production"):
        """Select the specified branch using Selenium"""
        print(f"Attempting to select branch: {branch_name}")

        try:

            self.driver.get('https://devops.housing.sa:8083/ejar3/devs/ejar3-run-script-tool/-/pipelines/new')
            self.reload_page()
            # Wait for the page to fully load by checking the presence of the fieldset
            self.wait.until(
                EC.presence_of_element_located((By.TAG_NAME, 'fieldset'))
            )

            # Navigate directly to pipeline page (user already logged in)
            print("Navigating to GitLab pipeline page...")
            self.driver.get('https://devops.housing.sa:8083/ejar3/devs/ejar3-run-script-tool/-/pipelines/new')

            # Wait for the page to fully load by checking the presence of the fieldset
            ref_selector_div = self.wait.until(
                EC.presence_of_element_located((By.CLASS_NAME, 'ref-selector'))
            )

            # Find the button with ID 'dropdown-toggle-btn-34' inside the fieldset
            dropdown_button = ref_selector_div.find_element(By.ID, 'dropdown-toggle-btn-34')

            # Click the button
            dropdown_button.click()

            # Wait for the div with ID 'base-dropdown-36' to be present
            base_dropdown_div = self.wait.until(
                EC.presence_of_element_located((By.ID, 'base-dropdown-36'))
            )

            time.sleep(1)

            # Find the ul inside the parent div
            ul_element = base_dropdown_div.find_element(By.TAG_NAME, 'ul')

            # Select the li element in order based on branch_name
            if branch_name.lower() == "development":
                index = 4
            elif branch_name.lower() == "production":
                index = 5
            elif branch_name.lower() == "test":
                index = 6
            elif branch_name.lower() == "uat":
                index = 7
            else:
                raise ValueError(f"Invalid branch name: {branch_name}")

            selected_li_element = ul_element.find_elements(By.TAG_NAME, 'li')[index]
            selected_li_element.click()
            time.sleep(2)

            print(f"Successfully selected branch: {branch_name}")
            return True

        except Exception as e:
            print(f"Error selecting branch: {e}")
            return False

    def read_script(self, script_name):
        """Read the ruby script file"""
        try:
            with open(f"{SCRIPTS_PATH}/{script_name}.rb", 'r') as file:
                script = file.read()
            return script
        except Exception as e:
            print(f"Error reading ruby script: {e}")
            return None

    def fetch_ticket_description_from_script(self, script_content):
        """Fetch ticket description from Ruby script content"""
        try:
            print("🔍 Extracting ticket description from script content...")

            # Pattern to match: task TASK_NAME: :environment do
            pattern = r'task\s+([a-zA-Z0-9_]+)\s*:\s*:environment\s+do'

            match = re.search(pattern, script_content)
            if match:
                task_name = match.group(1)
                print(f"✓ Extracted ticket description: '{task_name}'")
                return task_name
            else:
                print("✗ No task name found in script content")
                return None

        except Exception as e:
            print(f"✗ Error extracting ticket description: {e}")
            return None

    def process_ci_variables(self, ticket_description, script, ejar_service):
        """Process CI variable containers with provided parameters"""
        try:
            print("Processing CI variables...")
            print(f"Ticket Description: {ticket_description}")
            print(f"Script: {script}")
            print(f"Ejar Service: {ejar_service}")

            # Find all divs with attribute data-testid="ci-variable-row-container"
            ci_variable_row_containers = self.wait.until(
                EC.presence_of_all_elements_located(
                    (By.CSS_SELECTOR, 'div[data-testid="ci-variable-row-container"]')
                )
            )

            # Check if ejar_service contains "sec" keyword
            if "sec" in ejar_service.lower():
                print("🔍 'sec' keyword detected in ejar_service - extracting ticket description from script...")

                # Extract ticket description from script content
                extracted_description = self.fetch_ticket_description_from_script(script)

                if extracted_description:
                    # Update ticket description with extracted task name
                    ticket_description = extracted_description
                    print(f"✓ Updated ticket description to: '{ticket_description}'")
                else:
                    print("⚠️ Could not extract ticket description, using original ticket description")

            # FIRST CONTAINER: Set ticket description in textarea
            print("Setting ticket description in first container...")
            first_container = ci_variable_row_containers[0]
            textarea = first_container.find_element(By.CSS_SELECTOR, '[data-testid="pipeline-form-ci-variable-value-field"]')
            textarea.clear()
            textarea.send_keys(ticket_description)
            print(f"✓ Set ticket description: '{ticket_description}'")

            # SECOND CONTAINER: Select ejar3 service from dropdown
            print("Selecting ejar3 service in second container...")
            second_container = ci_variable_row_containers[1]
            dropdown_btn = second_container.find_element(By.CSS_SELECTOR, '[data-testid="pipeline-form-ci-variable-value-dropdown"]')
            dropdown_btn.click()
            time.sleep(1)  # Wait for dropdown to open

            dropdown_div = self.wait.until(
                EC.visibility_of_element_located((By.ID, 'base-dropdown-59'))
            )

            listbox_ul = dropdown_div.find_element(By.ID, 'listbox-58')

            # Find the service option that matches the provided ejar_service
            service_options = listbox_ul.find_elements(By.TAG_NAME, 'li')
            service_selected = False

            for option in service_options:
                option_text = option.get_attribute('data-testid')
                if option_text and ejar_service.lower() in option_text.lower():
                    option.click()
                    service_selected = True
                    print(f"✓ Selected service: '{option_text.replace('listbox-item-', '')}'")
                    break

            if not service_selected:
                print(f"✗ Service '{ejar_service}' not found, using default (5th option)")
                fifth_ul_element = listbox_ul.find_elements(By.TAG_NAME, 'li')[4]
                fifth_ul_element.click()

            time.sleep(1)

            # THIRD CONTAINER: Set script name in textarea
            print("Setting script name in third container...")
            third_container = ci_variable_row_containers[2]
            textarea = third_container.find_element(By.CSS_SELECTOR, '[data-testid="pipeline-form-ci-variable-value-field"]')
            textarea.clear()
            textarea.send_keys(script)
            print(f"✓ Set script content (length: {len(script)} characters)")

            # Scroll down to make the button fully visible
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight - 500);")

            time.sleep(1)

            # Click the Run Pipeline button
            print("Clicking the Run Pipeline button...")
            run_pipeline_button = self.wait.until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-testid="run-pipeline-button"]'))
            )
            run_pipeline_button.click()

            print("Successfully processed CI variables and started pipeline")
            return True

        except Exception as e:
            print(f"Error processing CI variables: {e}")
            return False

    def wait_for_pipeline_page(self):
        """Wait for the pipeline page to load after running pipeline"""
        try:
            print("Waiting for pipeline page to load...")

            def pipeline_page_loaded(driver):
                current_url = driver.current_url
                print(f"Current URL: {current_url}")
                return current_url.startswith('https://devops.housing.sa:8083/ejar3/devs/ejar3-run-script-tool/-/pipelines/')

            # Wait up to 30 seconds for page navigation
            try:
                self.wait = WebDriverWait(self.driver, 30)
                self.wait.until(pipeline_page_loaded)
                print("✓ Pipeline page loaded successfully")
                return True
            except Exception as e:
                print(f"⚠️ Timeout waiting for pipeline page, continuing anyway: {e}")
                return True  # Continue execution even if URL check fails

        except Exception as e:
            print(f"Error waiting for pipeline page: {e}")
            return False

    def request_pipeline(self):
        """First step: Wait for and monitor the request stage"""
        try:
            print("=" * 50)
            print("STEP 1: Processing Pipeline Request Stage")
            print("=" * 50)

            print("Looking for request_prod badge...")

            # Find the request badge
            try:
                ci_badge_request_prod_div = WebDriverWait(self.driver, 20).until(
                    EC.presence_of_element_located((By.ID, 'ci-badge-request_prod'))
                )
                print("✓ Found request_prod badge")
            except Exception as e:
                print(f"✗ Could not find request_prod badge: {e}")
                print("Trying alternative selectors...")
                try:
                    ci_badge_request_prod_div = WebDriverWait(self.driver, 10).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, '[id*="ci-badge-request"]'))
                    )
                    print("✓ Found alternative request badge")
                except Exception as e:
                    print(f"✗ No request badge found: {e}")
                    return False

            # Monitor request stage until completion
            print("Monitoring request stage completion...")
            max_attempts = 20  # Maximum attempts to avoid infinite loop
            attempt = 0

            while attempt < max_attempts:
                try:
                    # Find the request badge again (in case page refreshed)
                    ci_badge_request_prod_div = WebDriverWait(self.driver, 10).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, '[id*="ci-badge-request"]'))
                    )

                    # Check the ci-icon status
                    ci_icon = ci_badge_request_prod_div.find_element(By.CSS_SELECTOR, '[data-testid="ci-icon"]')
                    icon_class = ci_icon.get_attribute('class')

                    print(f"Attempt {attempt + 1}: Request stage status - {icon_class}")

                    if 'ci-icon-variant-success' in icon_class:
                        print("✓ Request stage completed successfully!")
                        return True
                    elif 'ci-icon-variant-failed' in icon_class or 'ci-icon-variant-error' in icon_class:
                        print("✗ Request stage failed!")
                        return False
                    else:
                        print("⏳ Request stage still in progress so try reload page...")
                        self.reload_page()
                        

                except Exception as e:
                    print(f"⚠️ Error checking request stage status: {e}")
                    print("Refreshing page and retrying...")
                    self.reload_page()

                attempt += 1
                time.sleep(5)  # Wait 5 seconds before next check

            print("⚠️ Request stage monitoring timed out")
            return False

        except Exception as e:
            print(f"Error in request pipeline stage: {e}")
            return False

    def approve_pipeline_stage(self):
        """Second step: Handle the approval stage"""
        try:
            print("=" * 50)
            print("STEP 2: Processing Pipeline Approval Stage")
            print("=" * 50)

            print("Looking for approve_prod badge...")

            # Wait for the approve badge to appear
            try:
                ci_badge_approve_prod_div = WebDriverWait(self.driver, 20).until(
                    EC.presence_of_element_located((By.ID, 'ci-badge-approve_prod'))
                )
                print("✓ Found approve_prod badge")
            except Exception as e:
                self.reload_page()
                print(f"✗ Could not find approve_prod badge: {e}")
                print("Trying alternative selectors...")
                try:
                    ci_badge_approve_prod_div = WebDriverWait(self.driver, 10).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, '[id*="ci-badge-approve"]'))
                    )
                    print("✓ Found alternative approve badge")
                except Exception as e:
                    print(f"✗ No approve badge found: {e}")
                    return False

            time.sleep(2)  # Small delay for UI stability

            # Find and click the approve button
            try:
                print("Looking for approve button...")
                approve_button = ci_badge_approve_prod_div.find_element(By.CSS_SELECTOR, '[data-testid="ci-action-button"]')

                # Ensure button is visible and clickable
                self.driver.execute_script("arguments[0].scrollIntoView(true);", approve_button)
                time.sleep(1)

                # Check if button is enabled
                if not approve_button.is_enabled():
                    print("⚠️ Approve button is not enabled yet, waiting...")
                    self.reload_page()

                # Click the approve button
                approve_button.click()
                print("✓ Successfully clicked approve button")

                # Wait a moment for the approval to process
                time.sleep(3)

                # Optionally verify approval was successful
                try:
                    ci_icon = ci_badge_approve_prod_div.find_element(By.CSS_SELECTOR, '[data-testid="ci-icon"]')
                    icon_class = ci_icon.get_attribute('class')

                    if 'ci-icon-variant-success' in icon_class:
                        print("✓ Pipeline approval completed successfully!")
                    elif 'ci-icon-variant-pending' in icon_class or 'ci-icon-variant-running' in icon_class:
                        print("⏳ Pipeline approval is processing...")
                        self.reload_page()
                    else:
                        print(f"? Approval status: {icon_class}")

                except Exception as e:
                    print(f"⚠️ Could not verify approval status: {e}")

                return True

            except Exception as e:
                print(f"✗ Could not click approve button: {e}")

                # Try alternative approach - look for any clickable approve elements
                try:
                    print("Trying alternative approve button search...")
                    approve_buttons = self.driver.find_elements(By.CSS_SELECTOR, 'button[title*="approve"], button[title*="Approve"]')

                    for button in approve_buttons:
                        if button.is_displayed() and button.is_enabled():
                            button.click()
                            print("✓ Clicked alternative approve button")
                            return True

                    print("✗ No alternative approve buttons found")

                except Exception as e2:
                    print(f"✗ Alternative approve approach failed: {e2}")

                return False

        except Exception as e:
            print(f"Error in approve pipeline stage: {e}")
            return False
          
    def run_pipeline_stage(self):
        try:
              print("Looking for run pipeline badge...")
              ci_badge_runscript_prod_div = WebDriverWait(self.driver, 10).until(
                  EC.presence_of_element_located((By.ID, 'ci-badge-runscript_prod'))
              )
              print("✓ Found run pipeline badge")

              # Click the badge to redirect to pipeline execution page
              ci_badge_runscript_prod_div.click()
              print("✓ Redirected to pipeline execution page")

        except Exception as e:
            print(f"✗ Could not click run pipeline badge: {e}")
            return False
          
        time.sleep(15)
          
        """Fourth step: Monitor the pipeline execution until completion"""
        try:
          print("=" * 50)
          print("STEP 4: Monitoring Pipeline Execution")
          print("=" * 50)

          # Monitor pipeline execution until completion
          print("Checking for pipeline success...")
          max_attempts = 60  # Maximum attempts (5 minutes with 5-second intervals)
          attempt = 0

          while attempt < max_attempts:
              try:
                  # Find the pipeline-info div
                  pipeline_info_div = self.driver.find_element(
                      By.CSS_SELECTOR, 
                      'div[data-testid="pipeline-info"]'
                  )
                
                  pipeline_status_link = pipeline_info_div.find_element(
                      By.CSS_SELECTOR,
                      'a[data-testid="pipeline-status-link"]'
                  )
                  
                  aria_label = pipeline_status_link.get_attribute('aria-label')
                  
                  if aria_label and "Status: Passed" in aria_label:
                      self.pipeline_id = pipeline_info_div.find_element(By.CSS_SELECTOR, 'a[data-testid="pipeline-path"]').get_attribute('href').split('/')[-1]
                      print("✅ Pipeline execution PASSED!")
                      return True 

              except Exception as e:
                  # Element not found, continue monitoring
                  print(f"✗ Could not find pipeline-status-link: {e}")
                  pass

              attempt += 1
              
              if attempt < max_attempts:
                  self.reload_page()
                  print(f"⏳ Checking... (attempt {attempt}/{max_attempts})")
                  time.sleep(10)

          print("⚠️ Pipeline monitoring timed out")
          return False

        except Exception as e:
          print(f"💥 Error monitoring pipeline: {e}")
          return False

    def check_pipeline_status(self):
        """Check the overall status of the pipeline"""
        try:
            print("Checking overall pipeline status...")

            # Look for all pipeline stage badges
            stage_badges = self.driver.find_elements(By.CSS_SELECTOR, '[id*="ci-badge-"]')

            pipeline_status = {}

            for badge in stage_badges:
                try:
                    badge_id = badge.get_attribute('id')
                    ci_icon = badge.find_element(By.CSS_SELECTOR, '[data-testid="ci-icon"]')
                    icon_class = ci_icon.get_attribute('class')

                    if 'success' in icon_class:
                        status = "✅ Success"
                    elif 'failed' in icon_class or 'error' in icon_class:
                        status = "❌ Failed"
                    elif 'pending' in icon_class or 'running' in icon_class:
                        status = "⏳ Running"
                    else:
                        status = f"? Unknown ({icon_class})"

                    pipeline_status[badge_id] = status

                except Exception as e:
                    pipeline_status[badge_id] = f"❓ Error reading status"

            print("Pipeline Status Summary:")
            print("-" * 40)
            for stage, status in pipeline_status.items():
                print(f"{stage}: {status}")
            print("-" * 40)

            return pipeline_status

        except Exception as e:
            print(f"Error checking pipeline status: {e}")
            return {}


    def execute_pipeline(self):
        """Main pipeline approval orchestrator"""
        try:
            print("🚀 Starting Pipeline Approval Process")
            print("=" * 60)

            # Step 1: Wait for pipeline page to load
            if not self.wait_for_pipeline_page():
                print("❌ Failed to load pipeline page")
                return False

            # Step 2: Process request stage
            if not self.request_pipeline():
                print("❌ Failed at request pipeline stage")
                return False

            # Step 3: Process approval stage
            if not self.approve_pipeline_stage():
                print("❌ Failed at approval pipeline stage")
                return False

            # Step 4: Process run pipeline stage
            if not self.run_pipeline_stage():
                print("❌ Failed at run pipeline stage")
                return False

            print("=" * 60)
            print("✅ Pipeline approval process completed successfully!")
            return True

        except Exception as e:
            print(f"💥 Error in pipeline approval orchestrator: {e}")

            # Print debug information
            try:
                print(f"Current URL: {self.driver.current_url}")
                print(f"Page title: {self.driver.title}")
            except:
                pass

            return False

    def run_automation(self, branch_name="production", ticket_description="", script="", ejar_service=""):
        """Main automation function with refactored approval process"""
        try:
            # Validate required parameters
            if not ticket_description or not script or not ejar_service:
                print("Error: All parameters (ticket_description, script, ejar_service) are required")
                return False

            # Try to connect to existing Chrome first, then Firefox
            if not self.connect_to_existing_chrome():
                if not self.connect_to_existing_firefox():
                    print("Could not connect to any existing browser")
                    return False

            # Navigate to GitLab pipeline page
            if not self.navigate_to_gitlab_pipeline():
                return False

            # Select the branch
            if not self.select_branch(branch_name):
                return False

            # Read the script
            script_content = self.read_script(script)
            if not script_content:
                print("Error reading script")
                return False

            # Process CI variables with provided parameters
            if not self.process_ci_variables(ticket_description, script_content, ejar_service):
                return False

            # Use the refactored approval process
            if not self.execute_pipeline():
                print("Checking final pipeline status...")
                self.check_pipeline_status()
                return False

            # Final status check
            final_status = self.check_pipeline_status()

            print("🎉 Successfully completed automation with refactored approval process!")
            return True

        except Exception as e:
            print(f"Error in automation: {e}")
            return False

    def close(self):
        """Close the browser connection"""
        if self.driver:
            print("Closing browser...")
            self.driver.quit()
            self.driver = None

def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description='GitLab Pipeline Automation Script',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python script.py -t "ES-3456" -s "check_user_eligibility" -e "ejar3-sec"
  python script.py -t "TASK-123" -s "update_contract_status" -e "ejar3-core-app"
  python script.py -t "Bug fix" -s "script_name" -e "ejar3-sidekiq" -b "development"

Available Ejar Services:
  - ejar3-frontend
  - ejar3-core-app
  - ejar3-sidekiq
  - ejar3-cockpit
  - ejar3-ads-service
  - ejar3-agreement
  - ejar3-auth-service
  - ejar3-contract
  - ejar3-search-service
  - ejar3-security-deposit
  - ejar3-sec (special: extracts task name from script)
        """
    )

    parser.add_argument(
        '-t', '--ticket',
        required=True,
        help='Ticket description (e.g., "ES-3456") - will be auto-updated for sec services'
    )

    parser.add_argument(
        '-s', '--script',
        required=True,
        help='Ruby script filename without .rb extension (e.g., "check_user_eligibility")'
    )

    parser.add_argument(
        '-e', '--ejar-service',
        required=True,
        help='Ejar3 service name (e.g., "ejar3-core-app", "ejar3-sec")'
    )

    parser.add_argument(
        '-b', '--branch',
        default='production',
        help='Git branch to use (default: production)'
    )

    return parser.parse_args()

# Usage
if __name__ == "__main__":
    # Parse command line arguments
    try:
        args = parse_arguments()
    except SystemExit:
        sys.exit(1)

    # Display the parameters
    print("=" * 60)
    print("GitLab Pipeline Automation")
    print("=" * 60)
    print(f"Ticket Description: {args.ticket}")
    print(f"Script: {args.script}")
    print(f"Ejar Service: {args.ejar_service}")
    print(f"Branch: {args.branch}")

    # Special note for sec services
    if "sec" in args.ejar_service.lower():
        print("🔍 SEC service detected - will extract task name from script!")

    print("=" * 60)

    automator = GitLabPipelineAutomator()

    try:
        success = automator.run_automation(
            branch_name=args.branch,
            ticket_description=args.ticket,
            script=args.script,
            ejar_service=args.ejar_service
        )

        if success:
            print("\n✅ Automation completed successfully!")
            print(f"Pipeline ID: {self.pipeline_id}")
        else:
            print("\n❌ Automation failed!")
            sys.exit(1)

    except KeyboardInterrupt:
        print("\n⚠️ Automation interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")
        sys.exit(1)
    finally:
        automator.close()