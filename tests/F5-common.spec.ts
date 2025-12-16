import { test, expect } from "@playwright/test";
import path from "path";
import { login_student } from "./utils/arranges";
import fs from "fs";

test.beforeEach(async ({ page, baseURL }) => {
  await login_student(page, baseURL!);
});

//001
test.skip("Make a post", async ({ page }) => {
  //Get into the discussion page
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Discussion" }).click();
  
  //New post
  await page.getByRole("link", { name: "Post" , exact: true}).click();
  //Select
  await page.locator("select.select-bordered").nth(0).selectOption({ label: "Prob1" });
  await page.locator("input.input-bordered").nth(0).fill("First Post");
  await page.locator("textarea.textarea-bordered").nth(0).fill("This is the first post for Prob1");
  
  //Post
  await page.getByRole("button", { name: "Post" }).click();
  
  //check if success
  const text = await page.getByText(/Post \d+/).innerText();
  const PID = text.match(/\d+/)[0];
  await expect(page).toHaveURL(`http://localhost:8080/course/meow/discussion/${PID}`);
});

//002
test.skip("See the posts", async ({ page }) => {
  //Get into the discussion page
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Discussion" }).click();
  
  //check if success
  const count = await page.$$eval('a[href^="/course/meow/discussion/"]', as => as.filter(a => /^\/course\/meow\/discussion\/\d+$/.test(a.href.replace(location.origin, ''))).length);
  console.log(count);
  //await expect(count).toBeGreaterThan(0);

});
