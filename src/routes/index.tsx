import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Elevate — اكتشف فرصتك التالية" },
      {
        name: "description",
        content:
          "Elevate هي منصتك الشاملة لاكتشاف المسابقات والمنح الدراسية وفرص التطوع والوظائف للطلاب والخريجين.",
      },
      { property: "og:title", content: "Elevate — اكتشف فرصتك التالية" },
      {
        property: "og:description",
        content:
          "Elevate هي منصتك الشاملة لاكتشاف المسابقات والمنح الدراسية وفرص التطوع والوظائف للطلاب والخريجين.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <iframe
      src="/site/index.html"
      title="Elevate"
      style={{ border: 0, width: "100vw", height: "100vh", display: "block" }}
    />
  );
}
