#!/usr/bin/env node

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as azdev from "azure-devops-node-api";
import { AccessToken, DefaultAzureCredential } from "@azure/identity";
import { configurePrompts } from "./prompts.js";
import { configureAllTools } from "./tools.js";
import { userAgent } from "./utils.js";
import { packageVersion } from "./version.js";
const args = process.argv.slice(2);
if (args.length != 2) {  console.error(
    "Usage: mcp-server-azuredevops <organization_name> <pat|azurecli>"
  );
  process.exit(1);
}

export const orgName = args[0];
const authMethod = args[1];
const orgUrl = "https://dev.azure.com/" + orgName;

async function getAzureDevOpsToken(): Promise<AccessToken> {
  process.env.AZURE_TOKEN_CREDENTIALS = "dev";
  const credential = new DefaultAzureCredential(); // CodeQL [SM05138] resolved by explicitly setting AZURE_TOKEN_CREDENTIALS
  const token = await credential.getToken("499b84ac-1321-427f-aa17-267ca6975798/.default");
  return token;
}

async function getPersonalAccessToken(): Promise<string> {
    const pat = process.env.AZURE_DEVOPS_EXT_PAT;
    if (!pat) {
        throw new Error(
            "Personal Access Token (PAT) is not set. Please set the AZURE_DEVOPS_EXT_PAT environment variable.");
    }
    return pat;
}

async function getAzureDevOpsAuthHandler() {
  switch (authMethod) {
    case "pat":
      const pat = await getPersonalAccessToken();
      return azdev.getPersonalAccessTokenHandler(pat);
    case "azurecli":
      const token = await getAzureDevOpsToken();
      return azdev.getBearerHandler(token.token);
    default:
      throw new Error("Invalid authentication method. Use 'pat' or 'azurecli'.");
  }
}

async function getAzureDevOpsClient() : Promise<azdev.WebApi> {
  const authHandler = await getAzureDevOpsAuthHandler();
  return new azdev.WebApi(orgUrl, authHandler, undefined, {
    productName: "AzureDevOps.MCP",
    productVersion: packageVersion,
    userAgent: userAgent
  });
}

async function main() {
  const server = new McpServer({
    name: "Azure DevOps MCP Server",
    version: packageVersion,
  });

  configurePrompts(server);
  
  configureAllTools(
    server,
    getAzureDevOpsToken,
    getAzureDevOpsClient
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
