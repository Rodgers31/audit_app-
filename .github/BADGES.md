# GitHub Actions Status Badges

Add these badges to your README.md to show build status:

## For README.md

Add these at the top of your README.md file:

```markdown
# Government Financial Transparency Audit Application

![CI/CD Pipeline](https://github.com/YOUR_USERNAME/audit_app/workflows/CI/CD%20Pipeline/badge.svg)
![Build and Deploy](<https://github.com/YOUR_USERNAME/audit_app/workflows/Build%20and%20Deploy%20(Docker%20Hub)/badge.svg>)
![Tests](https://img.shields.io/badge/tests-passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-70%25-green)

🎉 **Production-Ready!** This application has been hardened for production deployment...
```

## Individual Badges

### CI/CD Pipeline Status

```markdown
![CI/CD Pipeline](https://github.com/YOUR_USERNAME/audit_app/workflows/CI/CD%20Pipeline/badge.svg)
```

### Docker Build Status

```markdown
![Build and Deploy](<https://github.com/YOUR_USERNAME/audit_app/workflows/Build%20and%20Deploy%20(Docker%20Hub)/badge.svg>)
```

### Backend Tests

```markdown
![Backend Tests](https://github.com/YOUR_USERNAME/audit_app/workflows/CI/CD%20Pipeline/badge.svg?event=push&job=test-backend)
```

### Frontend Tests

```markdown
![Frontend Tests](https://github.com/YOUR_USERNAME/audit_app/workflows/CI/CD%20Pipeline/badge.svg?event=push&job=test-frontend)
```

### Code Coverage (if using Codecov)

```markdown
[![codecov](https://codecov.io/gh/YOUR_USERNAME/audit_app/branch/main/graph/badge.svg)](https://codecov.io/gh/YOUR_USERNAME/audit_app)
```

## Setup Instructions

1. Replace `YOUR_USERNAME` with your GitHub username
2. Replace `audit_app` with your repository name (if different)
3. Add to your README.md
4. Badges will automatically update based on workflow runs

## Custom Status Badges

You can also create custom badges:

### Test Count

```markdown
![Tests](https://img.shields.io/badge/tests-243%20E2E%20%2B%2050%20unit-brightgreen)
```

### Coverage

```markdown
![Coverage](https://img.shields.io/badge/coverage-70%25-green)
```

### Security

```markdown
![Security](https://img.shields.io/badge/security-hardened-blue)
```

### License

```markdown
![License](https://img.shields.io/badge/license-MIT-blue)
```

## Badge Colors

- `brightgreen` - All passing
- `green` - Good status
- `yellow` - Warning
- `red` - Failure
- `blue` - Info

## Example Full Header

```markdown
# Kenya Audit Transparency API

![CI/CD](https://github.com/YOUR_USERNAME/audit_app/workflows/CI/CD%20Pipeline/badge.svg)
![Deploy](<https://github.com/YOUR_USERNAME/audit_app/workflows/Build%20and%20Deploy%20(Docker%20Hub)/badge.svg>)
![Tests](https://img.shields.io/badge/tests-243%20passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-70%25-green)
![Security](https://img.shields.io/badge/security-hardened-blue)
![License](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/python-3.11-blue)
![Node](https://img.shields.io/badge/node-18.x-green)

🎉 **Production-Ready!** Comprehensive platform for transparent government financial data.
```
