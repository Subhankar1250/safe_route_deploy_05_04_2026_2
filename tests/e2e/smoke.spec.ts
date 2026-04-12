import { test, expect } from "@playwright/test";

test("login page loads", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("tab", { name: /Guardian/i })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Driver/i })).toBeVisible();
});
