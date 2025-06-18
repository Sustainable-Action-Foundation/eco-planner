
let port = 3000; // Default port

const args = process.argv.slice(2); // Remove the first two elements (node and script path)

// Check if the user provided a port number via command line arguments
if (args.includes("-p") || args.includes("--port")) {
  const portIndex = args.indexOf("-p") !== -1 ? args.indexOf("-p") : args.indexOf("--port");
  if (portIndex + 1 < args.length) {
    port = parseInt(args[portIndex + 1], 10);
    if (isNaN(port) || port <= 0 || port > 65535) {
      console.error("Invalid port number provided. Please provide a valid port between 1 and 65535.");
      process.exit(1);
    }
  } else {
    console.error("Port number not provided after -p or --port flag.");
    process.exit(1);
  }
}

fetch(`http://localhost:${port}/api/health`)
  .then(res => res.json())
  .then(data => {
    if (data.status === "ok") {
      console.info("Web server health check passed:", data);
      process.exit(0);
    } else {
      console.error("Web server health check failed:", data);
      process.exit(1);
    }
  })
  .catch(err => {
    console.error("Web server health check error:", err);
    process.exit(1);
  });