# Sample Architecture for VSCode Extension Testing

This folder contains a set of CALM architecture files designed to test the features of the CALM VSCode Extension, specifically **multi-document navigation**.

## Contents

-   **`system.json`**: The root system definition. Contains a `detailed-architecture` reference to the Payment Service.
-   **`payment-service.json`**: The detailed architecture for the Payment Service.
-   **`calm-mapping.json`**: A mapping file used to resolve the `detailed-architecture` URL to the local `payment-service.json` file.

## How to Scale/Test

1.  **Configure Mapping**: Ensure your VSCode settings point to the mapping file:
    ```json
    "calm.urlMapping": "calm-plugins/sample-architecture/calm-mapping.json"
    ```
2.  **Open Root**: Open `system.json`.
3.  **Preview**: Open the CALM Preview (`Ctrl+Shift+C` or Command Palette).
4.  **Navigate**: Click the **Payment Service** node in the preview.
    -   *Expected Behavior*: `payment-service.json` opens in the primary editor column, keeping the preview visible.

This setup verifies that the extension allows users to navigate distributed architecture models that use unique IDs for linking.
