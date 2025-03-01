# FLUX.1-dev Image Generation API Integration

This directory contains a Next.js integration with the [FLUX.1-dev](https://huggingface.co/black-forest-labs/FLUX.1-dev) image generation model from Hugging Face.

## Features

- API route that interacts with FLUX.1-dev image generation model
- Interactive demo page for generating images
- Proper error handling

## Usage

### API Endpoint

The API is available at `/api/flux` and accepts POST requests with the following JSON payload:

```json
{
  "prompt": "A beautiful portrait of a cat in a garden"
}
```

#### Parameters

- `prompt` (required): The text description of the image you want to generate

#### Response

The API returns a JSON response with the following structure:

```json
{
  "success": true,
  "imageData": "data:image/jpeg;base64,/9j/4AAQSkZJRgABA..."
}
```

Where `imageData` is a base64-encoded data URL that can be directly used as the src attribute of an img tag.

### Demo Page

A demo page is available at `/flux-demo` that provides an interface to interact with the API.

## Setup

1. Make sure you have a valid Hugging Face API key set in your `.env.local` file:

```
HUGGINGFACE_API_KEY=your_api_key_here
```

2. Start your Next.js development server:

```bash
npm run dev
# or
yarn dev
```

3. Navigate to http://localhost:3000/flux-demo to use the demo page

## Important Notes

- Image generation can be resource-intensive and may take several seconds to process.
- Be as descriptive as possible in your prompts for better results.
- FLUX.1-dev produces images at a fixed size and with default settings.

## Troubleshooting

- If you get authentication errors, check that your `HUGGINGFACE_API_KEY` is set correctly in `.env.local`
- If you get rate limit errors, you may need to upgrade your Hugging Face account or reduce the number of requests

## Testing

A test script is provided to verify the API functionality from the command line:

```bash
node app/flux-demo/test-flux-api.js
``` 