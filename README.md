# GitLab Pipeline Automation Tool

This repository contains automation scripts for GitLab pipeline management, specifically designed for automating the creation, approval, and monitoring of GitLab pipelines. The tool supports both Python and JavaScript implementations.

## Features

- **Automated Pipeline Creation**: Automatically create GitLab pipelines with configurable variables
- **Branch Selection**: Support for multiple branches (development, production, test, uat)
- **Service Selection**: Automated selection of Ejar3 services from dropdown
- **Pipeline Approval Workflow**: Complete automation of request → approve → run pipeline stages
- **Real-time Monitoring**: Monitor pipeline execution status until completion
- **Script Integration**: Read and process Ruby scripts from external directory
- **Browser Support**: Chrome (with remote debugging) and Firefox browser support

## Repository Structure

```
gitlab_automation_tool/
├── pipeline_automation.py    # Python implementation using Selenium
├── pipeline_automation.js    # JavaScript implementation using selenium-webdriver
├── package.json              # Node.js dependencies
└── README.md                 # This file
```

## Prerequisites

### For Python Version
- Python 3.7+
- Selenium WebDriver
- Firefox or Chrome browser

### For JavaScript Version
- Node.js 14.0+
- npm or yarn
- Chrome or Firefox browser

## Installation

### Python Setup
```bash
pip install selenium argparse
```

### JavaScript Setup
```bash
npm install
```

## Configuration

### Browser Setup

#### Chrome (Recommended)
Start Chrome with remote debugging enabled:
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

#### Firefox
The script will automatically connect to Firefox with existing profile.

### Script Directory
Update the `SCRIPTS_PATH` variable in both scripts to point to your Ruby scripts directory:
```
SCRIPTS_PATH = "/path/to/your/wareef-scripts"
```

## Usage

### Prerequisites for Execution

Before running either script, ensure you have:

1. **Browser Setup**: Start Chrome with remote debugging (recommended):
   ```bash
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
   ```

2. **GitLab Authentication**: Make sure you're logged into GitLab in your browser

3. **Script Directory**: Verify that your Ruby scripts are in the correct path (update `SCRIPTS_PATH` in the scripts if needed)

### Step-by-Step Execution

#### Python Version

1. **Install Dependencies**:
   ```bash
   pip install selenium argparse
   ```

2. **Run the Script**:
   ```bash
   python pipeline_automation.py -t "ES-3456" -s "check_user_eligibility" -e "ejar3-sec"
   ```

3. **Alternative with Virtual Environment**:
   ```bash
   # Create virtual environment
   python -m venv gitlab_automation_env
   
   # Activate virtual environment
   source gitlab_automation_env/bin/activate  # On macOS/Linux
   # gitlab_automation_env\Scripts\activate   # On Windows
   
   # Install dependencies
   pip install selenium argparse
   
   # Run script
   python pipeline_automation.py -t "ES-3456" -s "check_user_eligibility" -e "ejar3-sec"
   ```

#### JavaScript Version

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run the Script**:
   ```bash
   node pipeline_automation.js -t "ES-3456" -s "check_user_eligibility" -e "ejar3-sec"
   ```

3. **Alternative with NPM Script**:
   ```bash
   # Using npm start (as defined in package.json)
   npm start -- -t "ES-3456" -s "check_user_eligibility" -e "ejar3-sec"
   ```

### Quick Start Commands

#### Python (One-liner)
```bash
pip install selenium argparse && python pipeline_automation.py -t "YOUR_TICKET" -s "YOUR_SCRIPT" -e "YOUR_SERVICE"
```

#### JavaScript (One-liner)
```bash
npm install && node pipeline_automation.js -t "YOUR_TICKET" -s "YOUR_SCRIPT" -e "YOUR_SERVICE"
```

### Help Commands

To see all available options and their descriptions:

#### Python Version
```bash
python pipeline_automation.py -h
# or
python pipeline_automation.py --help
```

**Output:**
```
usage: pipeline_automation.py [-h] -t TICKET -s SCRIPT -e EJAR_SERVICE [-b BRANCH]

GitLab Pipeline Automation Script

options:
  -h, --help            show this help message and exit
  -t TICKET, --ticket TICKET
                        Ticket description (e.g., "ES-3456") - will be auto-updated for sec services
  -s SCRIPT, --script SCRIPT
                        Ruby script filename without .rb extension (e.g., "check_user_eligibility")
  -e EJAR_SERVICE, --ejar-service EJAR_SERVICE
                        Ejar3 service name (e.g., "ejar3-core-app", "ejar3-sec")
  -b BRANCH, --branch BRANCH
                        Git branch to use (default: production)

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
```

#### JavaScript Version
```bash
node pipeline_automation.js -h
# or
node pipeline_automation.js --help
```

**Output:**
```
Usage: pipeline-automation [options]

GitLab Pipeline Automation Script

Options:
  -V, --version                    display version number
  -t, --ticket <ticket>            Ticket description (e.g., "ES-3456") - will be auto-updated for sec services
  -s, --script <script>            Ruby script filename without .rb extension (e.g., "check_user_eligibility")
  -e, --ejar-service <service>     Ejar3 service name (e.g., "ejar3-core-app", "ejar3-sec")
  -b, --branch <branch>            Git branch to use (default: "production")
  -h, --help                       display help for command
```

### Command Line Arguments

| Argument | Short | Description | Required | Default |
|----------|-------|-------------|----------|---------|
| `--ticket` | `-t` | Ticket description (e.g., "ES-3456") | Yes | - |
| `--script` | `-s` | Ruby script filename without .rb extension | Yes | - |
| `--ejar-service` | `-e` | Ejar3 service name | Yes | - |
| `--branch` | `-b` | Git branch to use | No | production |

### Available Ejar Services

- `ejar3-frontend`
- `ejar3-core-app`
- `ejar3-sidekiq`
- `ejar3-cockpit`
- `ejar3-ads-service`
- `ejar3-agreement`
- `ejar3-auth-service`
- `ejar3-contract`
- `ejar3-search-service`
- `ejar3-security-deposit`
- `ejar3-sec` (special: extracts task name from script)

### Available Branches

- `development`
- `production` (default)
- `test`
- `uat`

## Examples

### Basic Usage
```bash
# Python
python pipeline_automation.py -t "ES-3456" -s "check_user_eligibility" -e "ejar3-core-app"

# JavaScript
node pipeline_automation.js -t "ES-3456" -s "check_user_eligibility" -e "ejar3-core-app"
```

### With Custom Branch
```bash
# Python
python pipeline_automation.py -t "TASK-123" -s "update_contract_status" -e "ejar3-sidekiq" -b "development"

# JavaScript
node pipeline_automation.js -t "TASK-123" -s "update_contract_status" -e "ejar3-sidekiq" -b "development"
```

### SEC Service (Auto-extracts task name)
```bash
# Python
python pipeline_automation.py -t "Bug fix" -s "security_check_script" -e "ejar3-sec"

# JavaScript
node pipeline_automation.js -t "Bug fix" -s "security_check_script" -e "ejar3-sec"
```

## How It Works

### Pipeline Automation Flow

1. **Browser Connection**: Connects to existing Chrome or Firefox browser
2. **Navigation**: Navigates to GitLab pipeline creation page
3. **Branch Selection**: Selects the specified branch from dropdown
4. **Script Reading**: Reads the Ruby script from the configured directory
5. **CI Variables Processing**: 
   - Sets ticket description
   - Selects Ejar service
   - Inputs script content
6. **Pipeline Execution**: Triggers pipeline creation
7. **Stage Monitoring**: Monitors three stages:
   - **Request Stage**: Waits for request approval
   - **Approval Stage**: Automatically approves the pipeline
   - **Run Stage**: Monitors execution until completion

### Special Features

#### SEC Service Processing
When using services containing "sec" in the name, the tool automatically:
- Extracts task names from Ruby script content
- Updates ticket description with extracted task name
- Pattern matching: `task TASK_NAME: :environment do`

#### Error Handling
- Comprehensive error handling at each stage
- Automatic page reloading on failures
- Fallback mechanisms for element selection
- Detailed logging for debugging

## Troubleshooting

### Common Issues

1. **Browser Connection Failed**
   - Ensure Chrome is started with remote debugging port 9222
   - Check if Firefox is properly installed

2. **Element Not Found**
   - Page might be loading slowly - script includes wait mechanisms
   - GitLab UI might have changed - check element selectors

3. **Script File Not Found**
   - Verify `SCRIPTS_PATH` is correctly configured
   - Ensure Ruby script exists with `.rb` extension

4. **Pipeline Timeout**
   - Pipeline might be taking longer than expected
   - Check GitLab pipeline page manually for status

### Debug Information

The script provides detailed console output including:
- Current URLs and page titles
- Element selection status
- Pipeline stage progress
- Error messages with context

## Security Considerations

- Scripts run with browser session permissions
- Ensure proper authentication to GitLab before running
- Review Ruby scripts before execution
- Use in trusted environments only

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with both Python and JavaScript versions
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review console output for error details
3. Verify browser and GitLab connectivity
4. Open an issue with detailed error information
