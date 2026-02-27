import { ApiError } from "./api-error";
import { env } from "./env";

export type DeploymentMode = "cloud" | "self-host";
export type SelfHostEdition = "community" | "enterprise";

export function getDeploymentMode(): DeploymentMode {
  return env.DEPLOYMENT_MODE ?? "self-host";
}

export function getSelfHostEdition(): SelfHostEdition {
  return env.SELF_HOST_EDITION ?? "community";
}

export function isCloudDeployment() {
  return getDeploymentMode() === "cloud";
}

export function isSelfHostedDeployment() {
  return getDeploymentMode() === "self-host";
}

export function isSelfHostedCommunity() {
  return isSelfHostedDeployment() && getSelfHostEdition() === "community";
}

export function isSelfHostedEnterprise() {
  return isSelfHostedDeployment() && getSelfHostEdition() === "enterprise";
}

export function getCommercialRuntimeProfile() {
  if (isCloudDeployment()) {
    return {
      deploymentMode: "cloud" as const,
      offering: "cloud-pro" as const,
      billingEnabled: true,
      licensingEnabled: false,
    };
  }

  const edition = getSelfHostEdition();

  return {
    deploymentMode: "self-host" as const,
    offering: edition,
    billingEnabled: false,
    licensingEnabled: edition === "enterprise",
  };
}

export function assertCloudBillingEnabled() {
  if (!isCloudDeployment()) {
    throw new ApiError(
      404,
      "Cloud billing APIs are only available when DEPLOYMENT_MODE=cloud.",
      "billing_unavailable_in_self_host",
    );
  }
}

export function assertEnterpriseLicensingEnabled() {
  if (!isSelfHostedEnterprise()) {
    throw new ApiError(
      404,
      "Enterprise licensing APIs are only available in self-host enterprise mode.",
      "licensing_unavailable_in_current_mode",
    );
  }
}
