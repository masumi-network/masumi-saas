export type EditAgentFormValues = {
  name: string;
  description?: string;
  apiUrl: string;
  tags?: string;
  icon?: string;
  termsOfUseUrl?: string;
  privacyPolicyUrl?: string;
  otherUrl?: string;
  capabilityName?: string;
  capabilityVersion?: string;
  exampleOutputs?: Array<{ name: string; url: string; mimeType: string }>;
};
