import { test, expect } from "@playwright/test";
import { login_student } from "./utils/arranges";
import fs from "fs";

test.beforeEach(async ({ page, baseURL }) => {
  await login_student(page, baseURL!);
});

//010
test("Can't make a post with code bf deadline", async ({ page }) => {
  //Get into the discussion page
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Discussion" }).click();
  
  //New post
  await page.getByRole("link", { name: "Post" , exact: true}).click();
  //Select
  await page.locator("select.select-bordered").nth(0).selectOption({ label: "Prob2" });
  await page.locator("input.input-bordered").nth(0).type("Code for Prob2");
  await page.locator("textarea.textarea-bordered").nth(0).type("```c++\n");
  const code = fs.readFileSync('./tests/add.cpp', 'utf-8');
  await page.locator("textarea.textarea-bordered").nth(0).type(code);
  await page.waitForTimeout(500);
  await page.locator("textarea.textarea-bordered").nth(0).type("\n```");
    
  //Post
  await page.getByRole("button", { name: "Post" }).click();
  await page.screenshot({ path: "scr.png" });
  
  //check if success
  await expect(page.getByText("This problem does not allow sharing code")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("discussion.err_failed_createRequest failed with status code 403")).toBeVisible({ timeout: 10000 });
  
});

