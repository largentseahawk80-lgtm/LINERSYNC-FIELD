# LINERSYNC

LINERSYNC is an **offline-first, field-ready Geosynthetic Liner Installation QC application** designed specifically for remote technical projects. It provides a robust, industrial-grade platform for Quality Control (QC) technicians to log, track, and report on every aspect of liner installation in environments where cellular connectivity is unreliable or non-existent.

## Core Features

- **Material Inventory Management**: Track rolls, lot numbers, and manufacturer certifications with real-time status updates.
- **Seam Logging**: Comprehensive logging of fusion and extrusion welds, including welder association and machine tracking.
- **Dynamic Destructive Testing**: Real-time validation of peel and shear tests against project-specific material specifications.
- **Repair & Patch Tracking**: Detailed logging of repairs with location stationing, repair types, and mandatory photo documentation.
- **Global Media Association**: A "No Orphaned Photos" system that tags every image with GPS coordinates, timestamps, and entity IDs (Seam, Repair, etc.).
- **Automated Daily PDF Reports**: One-click generation of professional, client-ready QC reports including data tables and a photo appendix.
- **Live Telemetry**: Persistent GPS monitoring and display to ensure spatial verification of all field activities.

## Tech Stack

- **Frontend**: React 19, TypeScript
- **Styling**: Tailwind CSS (Industrial Aesthetic)
- **Storage**: `idb` (IndexedDB for high-capacity offline media storage)
- **Reporting**: `jspdf` & `jspdf-autotable`
- **GIS Mapping**: SVG-based As-Built Renderer (extensible to `react-leaflet`)
- **Icons**: Lucide React
- **Animations**: Motion (formerly Framer Motion)

## Local Setup

To get a local development environment running, follow these steps:

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd linersync
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:3000`.

## Architecture Note: Offline-First Design

LINERSYNC is built with a strict **offline-first architecture**. Recognizing that geosynthetic installation often occurs in remote basins or landfills with zero connectivity, the application utilizes a dual-layer persistence strategy:

1. **Metadata Persistence**: All logs (Rolls, Seams, Repairs, Tests) are synchronized to `localStorage` for immediate persistence across session refreshes.
2. **Media Persistence**: Large binary image data is managed via **IndexedDB** using the `idb` library. This ensures that high-resolution field photos do not bloat the browser's string storage and remain accessible even after the device is powered down.

This design ensures that **data is never lost** when moving out of cellular range, allowing technicians to perform their entire day's work offline and generate reports locally.
