# Custom Sidebar Example

_This example is built using NextJS, shadcn/ui, and the `@simplepdf/react-embed-pdf` package. Vanilla JS is also supported using the Iframe: [iframe example](../with-iframe/README.md)_

It demonstrates how to customize the SimplePDF editor by hiding the default sidebar and implementing a custom sidebar with tailored controls.

Additionally, it showcases programmatic control of the editor, allowing developers to interact with the PDF editor via code.

## Features

- **Custom Sidebar**: The default SimplePDF sidebar is hidden, replaced with a custom sidebar containing tools for text, checkboxes, signatures, images, and document uploads, along with a submit button and a download toggle.

- **Programmatic Control**: Use the `useEmbed` hook to programmatically control the SimplePDF editor, including submitting the document and selecting tools: [documentation](../../react/README.md#programmatic-control)


## Installation

1. **Clone the Repository** (or create a new project directory):
   ```sh
   git clone https://github.com/SimplePDF/simplepdf-embed.git
   cd examples/with-custom-sidebar
   ```

2. **Install Dependencies**:
   ```sh
   npm install
   ```

3. **Run the Development Server**:
   ```sh
   npm run dev
   ```
   - Open your browser to `http://localhost:3000` to view the app.