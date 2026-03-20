"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveApiConfigAction, testApiConfigAction } from "@/app/actions/system";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface ApiConfigFormLabels {
  connectionName: string;
  baseUrlPlaceholder: string;
  apiKeyPlaceholder: string;
  testConnection: string;
  saveApi: string;
  apiConfigSaved: string;
}

interface ApiConfigFormProps {
  labels: ApiConfigFormLabels;
}

export function ApiConfigForm({ labels }: ApiConfigFormProps) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [headers, setHeaders] = useState('{"X-Source":"sst"}');

  function onSave() {
    startTransition(async () => {
      const result = await saveApiConfigAction({
        name,
        base_url: baseUrl,
        api_key: apiKey,
        headers_json: headers,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(labels.apiConfigSaved);
      setName("");
      setBaseUrl("");
      setApiKey("");
      setHeaders('{"X-Source":"sst"}');
    });
  }

  function onTest() {
    startTransition(async () => {
      const result = await testApiConfigAction({
        base_url: baseUrl,
        api_key: apiKey,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
    });
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <Input placeholder={labels.connectionName} value={name} onChange={(event) => setName(event.target.value)} />
      <Input placeholder={labels.baseUrlPlaceholder} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
      <Input placeholder={labels.apiKeyPlaceholder} value={apiKey} onChange={(event) => setApiKey(event.target.value)} type="password" />
      <Textarea value={headers} onChange={(event) => setHeaders(event.target.value)} rows={3} />
      <div className="flex gap-2">
        <Button onClick={onTest} variant="outline" disabled={pending} data-audit-action="test-api-connection" data-audit-type="it-panel">
          {labels.testConnection}
        </Button>
        <Button onClick={onSave} disabled={pending} data-audit-action="save-api-config" data-audit-type="it-panel">
          {labels.saveApi}
        </Button>
      </div>
    </div>
  );
}
