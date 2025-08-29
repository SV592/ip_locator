"use client";
import React, { useRef } from "react";

import Globe from "./components/Globe";

export default function Home() {
  return (
    <div className="w-screen h-screen flex justify-center items-center">
      <Globe />
    </div>
  );
}
