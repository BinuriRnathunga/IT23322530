# SwiftTranslator Automation Testing Project

## 📝 Overview
This project contains automated testing scripts for SwiftTranslator (https://swifttranslator.com/) using Playwright. The tests are data-driven, reading test cases from Excel files and automatically validating translation functionality.

## 🎯 Features
- Data-driven testing using Excel files
- Automated translation validation
- Test result reporting with screenshots and videos on failure
- Excel test case management with automatic status updates
- Support for multiple test scenarios

## 🛠️ Technologies Used
- **Node.js** - Runtime environment
- **Playwright** - Browser automation framework
- **XLSX** - Excel file handling
- **CommonJS** - Module system

## 📋 Prerequisites
- Node.js (version 14 or higher)
- npm (Node Package Manager)

## 🚀 Installation

1. Clone the repository:
```bash
git clone https://github.com/BinuriRnathunga/IT23322530.git
cd IT23322530
```

2. Install dependencies:
```bash
npm install
```

3. Install Playwright browsers:
```bash
npx playwright install
```

## 📂 Project Structure
```
IT23322530/
├── tests/
│   └── IT23322530_translator.spec.js  # Main test specification
├── test-data/                          # Excel test case files
├── test-results/                       # Test execution results
├── playwright-report/                  # HTML test reports
├── package.json                        # Project dependencies
├── playwright.config.cjs               # Playwright configuration
└── README.md                           # Project documentation
```

## 📊 Test Data Format
Place your test data in the `test-data/` directory with the following Excel format:

| TC ID | Input | Expected output | Actual output | Status |
|-------|-------|-----------------|---------------|--------|


## ▶️ Running Tests

Run all tests:
```bash
npx playwright test
```

Run tests with HTML report:
```bash
npx playwright test --reporter=html
```

View the last test report:
```bash
npx playwright show-report
```

Run tests in headed mode (visible browser):
```bash
npx playwright test --headed
```

## 📈 Test Reports
- HTML reports are generated in the `playwright-report/` directory
- Test results are saved in the `test-results/` directory
- Executed test cases are saved back to Excel with actual outputs and status

## ⚙️ Configuration
Test configuration can be modified in [playwright.config.cjs](playwright.config.cjs):
- Test directory
- Test match patterns
- Reporters
- Timeout settings
- Browser options (headless, screenshots, videos, traces)

## 📝 Test Execution Flow
1. Reads test cases from Excel file (or previously executed version)
2. For each test case:
   - Navigates to SwiftTranslator
   - Enters input text
   - Waits for translation
   - Captures actual output
   - Compares with expected output
3. Updates Excel file with actual results and status
4. Generates HTML report

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License
ISC

## 👤 Author
IT23322530

## 🐛 Known Issues
- Some dynamic selectors may need adjustment based on website updates
- Translation timing may vary based on network conditions

## 📞 Support
For issues or questions, please create an issue in the GitHub repository.
