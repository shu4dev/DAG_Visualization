# Getting Started

## Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0

## Installation

```bash
# Install pnpm if you haven't already
npm install -g pnpm

# Clone the repository
git clone <repository-url>
cd DAG_Visualization

# Install dependencies
pnpm install
```

## Running the Development Server

```bash
# Start the dev server (runs the app package)
pnpm dev
```

The application will open at `http://localhost:3000`

## Project Structure

This is a monorepo with 7 packages:

- **types**: Shared TypeScript type definitions
- **utils**: Utility functions (math, data parsing, colors)
- **core**: DAG data structures and operations
- **physics**: Force-directed layout engine
- **text-analysis**: Text processing and word frequency analysis
- **renderer**: Three.js/React Three Fiber components
- **app**: Main React application

## Loading Sample Data

Sample data files are located in `packages/app/public/sample-data/`:

- `simple-dag.json`: Basic 3-layer DAG example
- `word-frequency-timeline.json`: Time-sliced word frequency data

## Next Steps

- [Understanding Data Formats](data-formats.md)
- [Customizing Physics Forces](creating-custom-forces.md)
- [Architecture Overview](../architecture/overview.md)
