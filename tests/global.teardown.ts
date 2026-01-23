import { exec } from "node:child_process";

export default function teardown() {
  exec("docker compose -f docker/compose.testing.yaml down", (error, stdout, stderr) => {
    if (error) {
      console.error(`Error during global teardown: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Stderr during global teardown: ${stderr}`);
      return;
    }
    console.log(`Stdout during global teardown: ${stdout}`);
  });
}