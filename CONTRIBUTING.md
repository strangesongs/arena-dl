# Contributing to arena-dl

Thanks for your interest! Here's how to contribute.

## Local Development

```bash
git clone https://github.com/strangesongs/arena-chan-dl
cd arena-chan-dl
npm install
npm link
```

Now `arena-dl` will run from your local code.

## Testing Changes

Test your changes manually:

```bash
arena-dl get frog
arena-dl get frog ~/test-output
arena-dl get https://www.are.na/period-6wkfhxbqle8/we-take-care-of-each-other-xr-skwcd1ta
```

## Reporting Issues

- Test with the latest code first
- Include the full command you ran
- Include the error message
- If downloading a public channel, include the URL so we can reproduce

## Code Style

- Use 2-space indentation
- Avoid unnecessary comments
- Keep error messages clear and actionable
- Test locally before submitting

## Pull Requests

- Keep changes focused
- Update README if needed
- Test on your machine first
- Describe what changed and why
