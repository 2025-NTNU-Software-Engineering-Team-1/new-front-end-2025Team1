import { test, expect } from "@playwright/test";
import path from "path";
import { login_admin } from "./utils/arranges";

test.beforeEach(async ({ page }) => {
  await login_admin(page);
});

test("Admin can set problem", async ({ page }) => {
  //Add a prob
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Problems" }).click();
  await page.getByRole("link", { name: "New" }).click();
  
  await page.locator('input.input.input-bordered').nth(0).fill("Hw1");
  await page.locator('input.input.input-bordered').nth(1).fill("-1");
  
  await page.locator('textarea.textarea-bordered').nth(0).fill("plus");
  await page.locator('textarea.textarea-bordered').nth(1).fill("10 20");
  await page.locator('textarea.textarea-bordered').nth(2).fill("30");
  await page.locator('textarea.textarea-bordered').nth(3).fill("+");
  
  const filePath = path.join(process.env.HOME!, "Downloads", "Prob1.zip"); // Linux Home/Downloads
  await page.locator('#file-uploader').setInputFiles(filePath);
  await page.waitForTimeout(1000);
  
  await page.locator('input.input.input-bordered').nth(4).fill("100");
  
  await page.locator('button:has-text("Submit")').click();
  await page.waitForTimeout(2000);

  const currentUrl = page.url(); // Get the current URL
  console.log('Current URL:', currentUrl);
});



