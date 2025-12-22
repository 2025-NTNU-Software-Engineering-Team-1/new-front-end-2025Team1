import { test, expect } from "@playwright/test";
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
  await page.waitForTimeout(1000);
  const cards = page.locator('div.card').filter({ hasNot: page.locator('div.card'),});
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);

});

//003
test.skip("Code", async ({ page }) => {
  //Get into the discussion page
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Discussion" }).click();
  
  //New post
  await page.getByRole("link", { name: "Post" , exact: true}).click();
  //Select
  await page.locator("select.select-bordered").nth(0).selectOption({ label: "Prob1" });
  await page.locator("select.select-bordered").nth(2).selectOption({ label: "C++" });
  await page.locator("input.input-bordered").nth(0).type("First Code");
  await page.locator("textarea.textarea-bordered").nth(0).type("```c++\n");
  const code = fs.readFileSync('./tests/add.cpp', 'utf-8');
  await page.locator("textarea.textarea-bordered").nth(0).type(code);
  await page.waitForTimeout(500);
  await page.locator("textarea.textarea-bordered").nth(0).type("\n```");
    
  //Post
  await page.getByRole("button", { name: "Post" }).click();
  
  //check if success
  const text = await page.getByText(/Post \d+/).innerText();
  const PID = text.match(/\d+/)[0];
  await expect(page).toHaveURL(`http://localhost:8080/course/meow/discussion/${PID}`);
  //background
  await expect(page.locator("div.prose")).toHaveClass(/prose-pre:bg-zinc-800/);
  //color
  const keyword = page.locator("pre code .hljs-keyword").first();
  await expect(keyword).toBeVisible();
  const keywordColor = await keyword.evaluate(el => getComputedStyle(el).color);
  const normalText = page.locator("pre code").first();
  const normalColor = await normalText.evaluate(el => getComputedStyle(el).color);
  expect(keywordColor).not.toBe(normalColor);
  
});

//004
test.skip("Search the posts", async ({ page }) => {
  //Get into the discussion page
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Discussion" }).click();
  
  await page.locator("input.input-bordered").nth(0).fill("First Post");
  await page.getByPlaceholder("Search discussions...").locator("..").locator("button").click();
  
  //check if success
  await page.waitForTimeout(1000);
  const cards = page.locator('div.card').filter({ hasNot: page.locator('div.card'),});
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);

});

//005
test.skip("Sort the posts by Hot", async ({ page }) => {
  //Get into the discussion page
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Discussion" }).click();
  
  //Hot
  await page.getByRole("button", { name: "Hot" }).click();
  
  //check if success
  const likes = await page.evaluate(() => { return Array.from(document.querySelectorAll('div.card'))
  .filter(card => card.querySelector('div.card'))
    .map(card => {
      const likeBlock = card.querySelector('svg')?.parentElement;
      const num = likeBlock?.textContent.match(/\d+/);
      return num ? Number(num[0]) : 0;
    });
  });

  const sorted = [...likes].sort((a, b) => b - a);
  expect(likes).toEqual(sorted);

});

//006
test.skip("Sort the posts by New", async ({ page }) => {
  //Get into the discussion page
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Discussion" }).click();
  
  //New
  await page.getByRole("button", { name: "New" }).click();
  
  //check if success
  const dateElements = await page.locator(".post-date").allTextContents();
  const times = dateElements.map(dateStr => new Date(dateStr).getTime());
  expect(times).toEqual([...times].sort((a, b) => b - a));
  
});

//007
test.skip("Show the posts by Problem", async ({ page }) => {
  //Get into the discussion page
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Discussion" }).click();
  
  //Get into Prob1
  await page.locator('xpath=//*[@id="app"]/div/div[1]/div[2]/div[2]/div/div/div/div/div/div/div[1]/div[2]/a[2]').click();
  await page.locator('h3.card-title:has-text("Prob1")').click();
  
  //check if success
  await page.waitForTimeout(1000);
  const cards = page.locator('div.card').filter({ hasNot: page.locator('div.card'),});
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  
});

//008 Can't be auto but success
//009 Can't be auto but success
