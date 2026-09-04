// Executed by playwright-cli run-code, not by the application or its test suite.
async (page) => {
  const context = await page.context().browser().newContext({
    viewport: { width: 1200, height: 760 }, deviceScaleFactor: 2, reducedMotion: "reduce"
  });
  const capture = await context.newPage();
  capture.setDefaultTimeout(10000);
  const errors = [];
  capture.on("pageerror", (error) => errors.push(error.message));
  // Only the local preview can be contacted while making the images.
  await context.route("**/*", (route) => route.request().url().startsWith("http://127.0.0.1:4187/")
    ? route.continue() : route.abort());
  try {
    for (const locale of ["en", "zh-CN"]) {
      for (const scene of ["ask", "reply", "revise", "settings"]) {
        await capture.setViewportSize({ width: 1200, height: scene === "settings" ? 1000 : 760 });
        await capture.goto(`http://127.0.0.1:4187/scripts/readme/preview.html?scene=${scene}&locale=${locale}`);
        await capture.locator("iframe").waitFor();
        const panel = capture.frameLocator("iframe");
        const fixture = await capture.evaluate(async (language) => (await import("/scripts/readme/fixtures.mjs")).examples[language], locale);
        if (scene === "settings") {
          await panel.getByRole("heading", { name: "Ask or write from your screen." }).waitFor();
          await panel.getByRole("button", { name: "Settings", exact: true }).click();
          await panel.getByRole("tab", { name: "General", exact: true }).waitFor();
          await panel.getByText("Show suggestions automatically", { exact: true }).waitFor();
        } else {
          await panel.locator(".overlay-root").waitFor();
          await panel.getByRole("textbox", { name: "Ask AI a question" }).fill(fixture.question);
          await panel.getByRole("textbox", { name: "Ask AI a question" }).press("Enter");
          await panel.locator(".ask-answer--complete").waitFor();
          if (!(await panel.locator(".ask-answer").innerText()).includes(locale === "en" ? "Send Jamie" : "发给林悦")) {
            throw new Error(`Missing localized answer: ${locale}`);
          }
        }
        if (scene === "reply" || scene === "revise") {
          await panel.getByRole("textbox", { name: "Ask AI a question" }).fill(fixture.draftRequest);
          await panel.getByRole("textbox", { name: "Ask AI a question" }).press("Enter");
          await panel.getByText(fixture.candidates[0], { exact: true }).waitFor();
          if (scene === "revise") {
            await panel.getByRole("button", { name: "Revise suggestion", exact: true }).click();
            await panel.getByRole("textbox").fill(fixture.instruction);
          }
        }
        await capture.evaluate(async () => {
          await document.fonts.ready;
          await document.querySelector("iframe").contentDocument.fonts.ready;
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        });
        await capture.mouse.move(1190, 750);
        const frameBody = await panel.locator("body").innerText();
        if (locale === "en" && /[\u3400-\u9fff]/u.test(frameBody)) throw new Error("Chinese text in English screenshot");
        const dimensions = await panel.locator(scene === "settings" ? ".main-surface" : scene === "ask" ? ".ask-transcript" : ".candidate-stage").evaluate((node) => ({ content: node.scrollHeight, visible: node.clientHeight }));
        if (dimensions.content > dimensions.visible + 1) {
          await capture.screenshot({ path: `output/playwright/clipped-${scene}-${locale}.png` });
          throw new Error(`Panel content is clipped: ${scene}-${locale}: ${JSON.stringify(dimensions)}`);
        }
        await capture.screenshot({ path: `output/playwright/${scene}-${locale}.png`, animations: "disabled" });
        // Exercise the depicted revision flow after capturing its instruction state.
        if (scene === "revise") {
          await panel.getByRole("button", { name: "Revise", exact: true }).click();
          await panel.getByText(fixture.revisions[0], { exact: true }).waitFor();
          await panel.getByRole("button", { name: "Back to original suggestions" }).click();
          await panel.getByText(fixture.candidates[0], { exact: true }).waitFor();
        }
        if (scene === "reply" || scene === "revise") {
          await panel.getByRole("button", { name: "Ask AI about this page" }).click();
          await panel.getByText(fixture.question, { exact: true }).waitFor();
          await panel.getByRole("button", { name: "Open draft →" }).click();
          await panel.getByText(fixture.candidates[0], { exact: true }).waitFor();
        }
        if (scene === "ask") {
          await panel.getByRole("button", { name: "Include captured page context" }).click();
          await panel.getByText("Page off", { exact: true }).waitFor();
          await panel.getByRole("button", { name: "Refresh screenshot and start a new conversation" }).click();
          await panel.getByText("What can I help with?", { exact: true }).waitFor();
          if (await panel.locator(".ask-turn").count()) throw new Error("Refresh did not clear the conversation");
        }
        console.log(`Captured and checked ${scene}-${locale}.png`);
      }
    }
    if (errors.length) throw new Error(errors.join("\n"));
  } catch (error) {
    await capture.screenshot({ path: "output/playwright/readme-capture-failure.png" });
    throw new Error(`${error.message}\nScene: ${capture.url()}\n${await capture.frameLocator("iframe").locator("body").innerText()}\n${errors.join("\n")}`);
  } finally {
    await context.close();
  }
}
