# Connections Multi-Account Status

The OOMOL Hosted details panel supports the current multi-account workflow:

- list accounts for each Provider;
- add or reconnect an account;
- select the current account;
- set the default account;
- disconnect an account;
- show default-account health as the Provider's primary status; and
- show secondary attention for other accounts.

The panel keeps current selection and default execution identity as separate state. Management requests pass through the loopback Host BFF, which validates identifiers and sanitizes responses.

Advanced connection activity, triggers, credential summaries, and team access remain available in OOMOL Console. Self-hosted OpenConnector management opens its external Console from the Connections button.

Future changes should preserve the compact details-panel layout and the existing `ConnectedApp` model unless a new user workflow requires additional data.
