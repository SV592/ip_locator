import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import dns from "dns";
import os from "os";

const execAsync = promisify(exec);
const dnsResolve = promisify(dns.resolve4);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ip } = body;

    if (!ip) {
      return NextResponse.json(
        { error: "IP address is required" },
        { status: 400 }
      );
    }

    // resolve domain to IP if needed
    let targetIp = ip;
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;

    if (!ipRegex.test(ip)) {
      try {
        const ips = await dnsResolve(ip);
        targetIp = ips[0];
      } catch (error) {
        return NextResponse.json(
          { error: "Failed to resolve domain" },
          { status: 400 }
        );
      }
    }

    // perform traceroute
    const tracerouteData = await performTraceroute(targetIp);

    // enrich hops with geolocation data
    const enrichedData = await enrichTracerouteData(tracerouteData);

    return NextResponse.json(enrichedData);
  } catch (error) {
    console.error("Trace error:", error);
    return NextResponse.json(
      { error: "Failed to trace route: " + error },
      { status: 500 }
    );
  }
}

async function performTraceroute(targetIp: string): Promise<any> {
  const platform = os.platform();
  let command: string;

  // platform-specific commands
  switch (platform) {
    case "win32":
      command = `tracert -h 30 -w 1000 ${targetIp}`;
      break;
    case "darwin":
      command = `traceroute -m 30 -w 1 -q 3 ${targetIp}`;
      break;
    default: // linux
      command = `traceroute -m 30 -w 1 -q 3 ${targetIp}`;
  }

  try {
    const { stdout } = await execAsync(command, {
      timeout: 30000, // 30 second timeout
      encoding: "utf8",
    });

    return parseTracerouteOutput(stdout, platform);
  } catch (error: any) {
    if (error.killed || error.signal === "SIGTERM") {
      throw new Error("Traceroute timeout");
    }
    throw error;
  }
}

function parseTracerouteOutput(output: string, platform: string): any {
  const lines = output.split("\n").filter((line) => line.trim());
  const hops: unknown[] = [];

  // skip header lines
  const startIndex = platform === "win32" ? 4 : 1;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];

    if (platform === "win32") {
      const hopMatch = line.match(/^\s*(\d+)/);
      if (!hopMatch) continue;

      const hopNumber = parseInt(hopMatch[1]);
      const times: number[] = [];
      const timeMatches = line.matchAll(/(\d+)\s*ms/g);

      for (const match of timeMatches) {
        times.push(parseFloat(match[1]));
      }

      // extract IP address
      const ipMatch =
        line.match(/$$([^$$]+)\]/) || line.match(/(\d+\.\d+\.\d+\.\d+)/);
      const ip = ipMatch ? ipMatch[1] : null;

      // extract hostname
      const hostMatch = line.match(/^\s*\d+\s+(?:[^[]*\s+)?([^\s\[]+)/);
      const hostname =
        hostMatch && !hostMatch[1].includes("ms") ? hostMatch[1] : null;

      if (ip || times.length > 0) {
        hops.push({
          hop: hopNumber,
          ip: ip || "*",
          hostname: hostname || ip || "*",
          rtt: times.length > 0 ? times : [null, null, null],
        });
      }
    } else {
      // unix traceroute format
      const hopMatch = line.match(/^\s*(\d+)\s+/);
      if (!hopMatch) continue;

      const hopNumber = parseInt(hopMatch[1]);

      // Check for "* * *"
      if (line.includes("* * *")) {
        hops.push({
          hop: hopNumber,
          ip: "*",
          hostname: "*",
          rtt: [null, null, null],
        });
        continue;
      }

      // extract hostname and IP
      const hostIpMatch = line.match(/^\s*\d+\s+([^\s]+)\s+$([^)]+)$/);
      const hostname = hostIpMatch ? hostIpMatch[1] : null;
      const ip = hostIpMatch ? hostIpMatch[2] : null;

      // extract RTT times
      const times: number[] = [];
      const timeMatches = line.matchAll(/(\d+\.?\d*)\s*ms/g);

      for (const match of timeMatches) {
        times.push(parseFloat(match[1]));
      }

      hops.push({
        hop: hopNumber,
        ip: ip || "*",
        hostname: hostname || ip || "*",
        rtt: times.length > 0 ? times : [null, null, null],
      });
    }
  }

  return { hops };
}

async function enrichTracerouteData(tracerouteData: any) {
  const enrichedHops = await Promise.all(
    tracerouteData.hops.map(async (hop: any) => {
      if (
        hop.ip &&
        hop.ip !== "*" &&
        !hop.ip.startsWith("192.168.") &&
        !hop.ip.startsWith("10.")
      ) {
        try {
          // use ipapi.co for geolocation
          const response = await fetch(`https://ipapi.co/${hop.ip}/json/`);
          const geoData = await response.json();

          if (geoData.error) {
            return { ...hop, location: null, org: null };
          }

          return {
            ...hop,
            location: {
              city: geoData.city || "Unknown",
              region: geoData.region || "",
              country: geoData.country_name || "Unknown",
              country_code: geoData.country_code || "",
              lat: geoData.latitude || 0,
              lon: geoData.longitude || 0,
            },
            org: geoData.org || "Unknown",
            asn: geoData.asn || null,
          };
        } catch (error) {
          console.error(`Failed to geolocate ${hop.ip}:`, error);
          return { ...hop, location: null, org: null };
        }
      }

      // local or no-response hop
      return {
        ...hop,
        location: null,
        org: hop.ip.startsWith("192.168.") ? "Local Network" : null,
      };
    })
  );

  // Get target details
  const targetHop = enrichedHops[enrichedHops.length - 1];
  const target =
    targetHop && targetHop.ip !== "*"
      ? {
          ip: targetHop.ip,
          hostname: targetHop.hostname,
          city: targetHop.location?.city || "Unknown",
          region: targetHop.location?.region || "",
          country: targetHop.location?.country || "Unknown",
          lat: targetHop.location?.lat || 0,
          lon: targetHop.location?.lon || 0,
          org: targetHop.org || "Unknown",
        }
      : null;

  return {
    target,
    hops: enrichedHops,
    summary: {
      totalHops: enrichedHops.length,
      respondingHops: enrichedHops.filter((h) => h.ip !== "*").length,
      countries: [
        ...new Set(
          enrichedHops
            .filter((h) => h.location?.country_code)
            .map((h) => h.location.country_code)
        ),
      ].length,
      averageRtt: calculateAverageRtt(enrichedHops),
    },
  };
}

function calculateAverageRtt(hops: any[]): number {
  const allRtts = hops
    .flatMap((h) => h.rtt)
    .filter((rtt) => rtt !== null && !isNaN(rtt));

  if (allRtts.length === 0) return 0;

  return allRtts.reduce((sum, rtt) => sum + rtt, 0) / allRtts.length;
}
