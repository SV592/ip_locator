"use client";
import React, { useRef } from "react";

import Scene from "./components/Scene";
import IPTracker from "./components/IPTracker";

export default function Home() {
  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Canvas background */}
      <div className="absolute inset-0">
        <Scene />
      </div>

      {/* UI overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Allow pointer events only on the Locator component */}
        <div className="pointer-events-auto max-w-4xl mx-auto pt-8 px-4">
          <IPTracker />
        </div>
      </div>
    </div>
  );
}
