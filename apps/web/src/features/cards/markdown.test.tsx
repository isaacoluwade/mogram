// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Markdown, cardContent } from "./markdown";

describe("card markdown (CA-2, AC-7)", () => {
  it("renders formatting, tables and code", () => {
    render(
      <Markdown
        source={"**Bold** and `code`\n\n| A | B |\n| - | - |\n| 1 | 2 |"}
        files={{}}
        folder=""
      />,
    );
    expect(screen.getByText("Bold").tagName).toBe("STRONG");
    expect(screen.getByText("code").tagName).toBe("CODE");
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("never renders raw HTML", () => {
    const { container } = render(
      <Markdown
        source={'<img src=x onerror="alert(1)"><script>alert(2)</script>Hi'}
        files={{}}
        folder=""
      />,
    );
    expect(container.querySelector("img, script")).toBeNull();
  });

  it("drops javascript: and data: links but keeps web and mail links, opening them safely", () => {
    render(
      <Markdown
        source={
          "[bad](javascript:alert(1)) [data](data:text/html,x) [web](https://example.com) [mail](mailto:a@b.c)"
        }
        files={{}}
        folder=""
      />,
    );
    expect(screen.getByText("bad").getAttribute("href")).toBe("");
    expect(screen.getByText("data").getAttribute("href")).toBe("");
    const web = screen.getByText("web");
    expect(web.getAttribute("href")).toBe("https://example.com");
    expect(web.getAttribute("rel")).toContain("noopener");
    expect(screen.getByText("mail").getAttribute("href")).toBe("mailto:a@b.c");
  });

  it("turns #element links into card navigation (CA-4)", () => {
    const onElementLink = vi.fn();
    render(
      <Markdown
        source="See the [replica](#db_replica)."
        files={{}}
        folder=""
        onElementLink={onElementLink}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "replica" }));
    expect(onElementLink).toHaveBeenCalledWith("db_replica");
  });

  it("shows images from the diagram folder and refuses other schemes", () => {
    const files = { "docs/diagram.png": "data:image/png;base64,AAAA" };
    const { container } = render(
      <Markdown
        source={"![ok](diagram.png) ![nope](http://insecure.example/x.png)"}
        files={files}
        folder="docs"
      />,
    );
    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(1);
    expect(images[0]?.getAttribute("src")).toBe("data:image/png;base64,AAAA");
  });
});

describe("cardContent (CA-3)", () => {
  it("takes the title from the markdown file's heading", () => {
    expect(
      cardContent(
        { kind: "file", title: null, path: "docs/web.md" },
        { "docs/web.md": "# Web VM\n\nRuns the store." },
        "Fallback",
      ),
    ).toEqual({
      title: "Web VM",
      body: "Runs the store.",
      missing: false,
    });
  });

  it("explains a missing file instead of failing", () => {
    expect(
      cardContent({ kind: "file", title: null, path: "docs/nope.md" }, {}, "Web VM"),
    ).toMatchObject({ title: "Web VM", missing: true });
  });
});
