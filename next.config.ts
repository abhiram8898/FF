import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating dev badge covers the sidebar footer
  devIndicators: false,
  // Screens that moved with FRD v0.2 keep their old links working
  async redirects() {
    return [
      { source: "/jobs", destination: "/enquiries", permanent: false },
      { source: "/masters/customers", destination: "/masters/stakeholders", permanent: false },
      { source: "/masters/agents", destination: "/masters/stakeholders", permanent: false },
      { source: "/masters/locations", destination: "/masters/geography", permanent: false },
      { source: "/masters/charges", destination: "/billing/charges", permanent: false },
    ];
  },
};

export default nextConfig;
