"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { agentApiClient } from "@/lib/api/agent.client";

type RegisterAgentFormType = {
  name: string;
  description: string;
  apiUrl: string;
  tags?: string;
};

interface RegisterAgentDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RegisterAgentDialog({
  open,
  onClose,
  onSuccess,
}: RegisterAgentDialogProps) {
  const t = useTranslations("App.Agents.Register");
  const [isLoading, setIsLoading] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const registerAgentSchema = z.object({
    name: z.string().min(1, t("nameRequired")).max(250, t("nameMaxLength")),
    description: z
      .string()
      .min(1, t("descriptionRequired"))
      .max(1000, t("descriptionMaxLength")),
    apiUrl: z
      .string()
      .url(t("apiUrlInvalid"))
      .refine(
        (val) => val.startsWith("http://") || val.startsWith("https://"),
        {
          message: t("apiUrlProtocol"),
        },
      ),
    tags: z.string().optional(),
  });

  const form = useForm<RegisterAgentFormType>({
    resolver: zodResolver(registerAgentSchema),
    defaultValues: {
      name: "",
      description: "",
      apiUrl: "",
      tags: "",
    },
  });

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput("");
      form.setValue("tags", [...tags, tag].join(", "));
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = tags.filter((tag) => tag !== tagToRemove);
    setTags(newTags);
    form.setValue("tags", newTags.join(", "));
  };

  const onSubmit = async (data: RegisterAgentFormType) => {
    setIsLoading(true);
    try {
      const result = await agentApiClient.registerAgent({
        name: data.name,
        description: data.description,
        apiUrl: data.apiUrl,
        tags: tags.join(", "),
      });

      if (result.success) {
        toast.success(t("success"));
        form.reset();
        setTags([]);
        setTagInput("");
        onSuccess();
        onClose();
      } else {
        toast.error(result.error || t("error"));
      }
    } catch (error) {
      toast.error(t("error"));
      console.error("Failed to register agent:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnOpenChange = (newOpen: boolean) => {
    if (isLoading) return;
    if (!newOpen) {
      form.reset();
      setTags([]);
      setTagInput("");
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOnOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("name")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("namePlaceholder")}
                      {...field}
                      className="bg-background"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("description")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("descriptionPlaceholder")}
                      {...field}
                      className="bg-background min-h-24"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="apiUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("apiUrl")}</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder={t("apiUrlPlaceholder")}
                      {...field}
                      className="bg-background"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>{t("tags")}</FormLabel>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder={t("tagsPlaceholder")}
                  className="bg-background"
                />
                <Button type="button" onClick={handleAddTag} variant="outline">
                  {t("addTag")}
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </FormItem>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOnOpenChange(false)}
                disabled={isLoading}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" variant="primary" disabled={isLoading}>
                {isLoading && <Spinner size={16} className="mr-2" />}
                {t("submit")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
