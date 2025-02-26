import { NextRequest, NextResponse } from "next/server";
import net from "net";

function errorResponse(status: number, message: string) {
  return NextResponse.json({ status, message });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // const searchParams = req.nextUrl.searchParams;
  // const ip = searchParams.get("ip")?.trim();
  // const port = searchParams.get("port")?.trim();
  const ip = req.nextUrl.searchParams.get("ip")?.trim();
  const port = req.nextUrl.searchParams.get("port")?.trim();

  if (!ip) return errorResponse(400, "Please provide an IP address");
  if (!port) return errorResponse(400, "Please provide a port number");
  if (!isValidIp(ip)) return errorResponse(400, "Invalid IP");
  if (!isValidPort(port)) return errorResponse(400, "Invalid port");

  try {
    const isOpen = await checkPort(ip, port);
    return NextResponse.json({
      status: 200,
      message: isOpen ? "Port is open" : "Port is closed",
    }) as NextResponse;
  } catch (err) {
    return NextResponse.json({
      status: 500,
      message: "An error occurred while checking the port",
    });
  }
}

function checkPort(ip: string, port: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(5000); // Set timeout for connection attempt
    socket.on("connect", () => {
      socket.end();
      resolve(true); // Port is open
    });
    socket.on("error", () => {
      resolve(false); // Port is closed or other error occurred
    });
    socket.on("timeout", () => {
      reject("Connection timed out"); // Timeout occurred
    });
    socket.connect(parseInt(port, 10), ip); // Connect to the specified port
  });
}

function isValidIp(ip: string): boolean {
  const s =
    /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return s.test(ip);
}

function isValidPort(port: string): boolean {
  const number = parseInt(port, 10);
  return !isNaN(number) && number >= 0 && number <= 65535;
}
