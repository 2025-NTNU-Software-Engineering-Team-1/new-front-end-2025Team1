import { test, expect } from "@playwright/test";
import path from "path";
import { login_teacher } from "./utils/arranges";

test.beforeEach(async ({ page, baseURL }) => {
  await login_teacher(page, baseURL!);
});

test("Teacher can set problem", async ({ page }) => {
  // Get in New prob setting pages
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Problems" }).click();
  await page.getByRole("link", { name: "New" }).click();
  
  //Name & Quotas
  await page.locator('input.input.input-bordered').nth(0).fill("Hw1");
  await page.locator('input.input.input-bordered').nth(1).fill("-1");
  
  //Descriptions, In/Output, and Hint
  await page.locator('textarea.textarea-bordered').nth(0).fill("plus");
  await page.locator('textarea.textarea-bordered').nth(1).fill("10 20");
  await page.locator('textarea.textarea-bordered').nth(2).fill("30");
  await page.locator('textarea.textarea-bordered').nth(3).fill("+");
  
  //Upload files (zip)
  const filePath = path.join(process.env.HOME!, "Downloads", "Prob1.zip"); // Linux Home/Downloads
  await page.locator('#file-uploader').setInputFiles(filePath);
  
  //set subtask score
  await page.waitForTimeout(1000);
  await page.locator('input.input.input-bordered').nth(4).fill("100");
  
  //submit
  await page.locator('button:has-text("Submit")').click();
  await page.waitForTimeout(1000);

  //check if success
  const PID = await page.locator('span').nth(0).textContent();
  await expect(page).toHaveURL(`http://localhost:8080/course/meow/problem/${PID}`);
});



