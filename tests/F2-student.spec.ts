import { test, expect } from "@playwright/test";
import path from "path";
import { login_student } from "./utils/arranges";
import fs from "fs";

test.beforeEach(async ({ page, baseURL }) => {
  await login_student(page, baseURL!);
});

//003
test("Student can see visible problem", async ({ page }) => {
  //Get into the problems page
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Problems" }).click();
  
  //Find all visible problems
  const problem_tds = page.locator("tr.hover td");
  await page.waitForTimeout(1000);
  const count = await problem_tds.count();
  
  //Find Prob1
  let PID = "";
  for (let i = 0; i < count / 5; ++i){
    const td = problem_tds.nth(i * 5 + 1);
    const name = await td.textContent();
    if (name == "Prob1")
    {
      const pid_td = problem_tds.nth(i * 5);
      PID = await pid_td.innerText();
      
      const link = await pid_td.locator("a");
      await link.click();
      break;
    }
  }
  await page.waitForTimeout(1000);
  
  //Check if success
  await expect(page).toHaveURL(`http://localhost:8080/course/meow/problem/${PID}`);
  await expect(page.locator("p").nth(0)).toHaveText("plus");
  await expect(page.locator("p").nth(1)).toHaveText("Two integers");
  await expect(page.locator("p").nth(2)).toHaveText("Sum");
  await expect(page.locator("p").nth(3)).toHaveText("\+");
  
  await expect(page.locator("code").nth(0)).toHaveText("10 20");
  await expect(page.locator("code").nth(1)).toHaveText("30");
  
  //Check subtask
  const subtask_tds = page.locator("tbody td");
  const score_td = await subtask_tds.nth(6);
  await expect(score_td).toHaveText("100");
  
});

//004 Can't submit
test.skip("Student can submit visible problem", async ({ page }) => {
  //Get into the problems page
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Problems" }).click();
  
  //Find all visible problems
  const tds = page.locator("tr.hover td");
  await page.waitForTimeout(1000);
  const count = await tds.count();
  
  //Find Prob1
  let PID = "";
  for (let i = 0; i < count / 5; ++i){
    const td = tds.nth(i * 5 + 1);
    const name = await td.textContent();
    if (name == "Prob1")
    {
      const pid_td = tds.nth(i * 5);
      PID = await pid_td.innerText();
      
      const link = await pid_td.locator("a");
      await link.click();
      break;
    }
  }
  await page.waitForTimeout(1000);
  
  //Submit
  await page.getByRole("link", { name: "Submit" }).click();
  const code = fs.readFileSync('./tests/add.cpp', 'utf-8');
  await page.locator('textarea[data-testid="textarea"]').fill(code);
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Submit")').click();
});

//005
test("Student can't see hidden problem", async ({ page }) => {
  //Get into the problems page
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Problems" }).click();
  
  //Can't find Prob2
  await expect(page.getByText("Prob2")).not.toBeVisible();
  
});

//006
test("Student can't submit expired Homework", async ({ page }) => {
  //Get into the problems page
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Homeworks" }).click();  
  
  const hw1Card = page.locator('.card-body')
                      .filter({ has: page.locator('.card-title', { hasText: 'Hw1' }) });

  const probRow = hw1Card.locator('tr').filter({ hasText: 'Prob1' }).locator('visible=true');

  await probRow.locator('a.link').first().click();

  const submitBtn = page.getByRole('link', { name: 'Submit' });

  await expect(submitBtn).toBeHidden();
});

//007 TODO
test.skip("Student submit a problem with Quotas", async ({ page }) => {
  //Get into the problems page
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Problems" }).click();
  
  //Find all visible problems
  const tds = page.locator("tr.hover td");
  await page.waitForTimeout(1000);
  const count = await tds.count();
  
  //Find Prob1
  let PID = "";
  for (let i = 0; i < count / 5; ++i){
    const td = tds.nth(i * 5 + 1);
    const name = await td.textContent();
    if (name == "Prob1")
    {
      const pid_td = tds.nth(i * 5);
      PID = await pid_td.innerText();
      
      const link = await pid_td.locator("a");
      await link.click();
      break;
    }
  }
  await page.waitForTimeout(1000);
  //TODO: Submit for thrice
});

//008 TODO
test.skip("Student submit a problem with Quotas reached limit", async ({ page }) => {
  //Get into the problems page
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Problems" }).click();
  
  //Find all visible problems
  const tds = page.locator("tr.hover td");
  await page.waitForTimeout(1000);
  const count = await tds.count();
  
  //Find Prob1
  let PID = "";
  for (let i = 0; i < count / 5; ++i){
    const td = tds.nth(i * 5 + 1);
    const name = await td.textContent();
    if (name == "Prob1")
    {
      const pid_td = tds.nth(i * 5);
      PID = await pid_td.innerText();
      
      const link = await pid_td.locator("a");
      await link.click();
      break;
    }
  }
  await page.waitForTimeout(1000);
  //TODO: Submit for four times
});

//011 TODO
test.skip("Student see TEST", async ({ page }) => {
  //Get into the problems page
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Problems" }).click();
  
  //Find all visible problems
  const tds = page.locator("tr.hover td");
  await page.waitForTimeout(1000);
  const count = await tds.count();
  
  //Find Prob1
  let PID = "";
  for (let i = 0; i < count / 5; ++i){
    const td = tds.nth(i * 5 + 1);
    const name = await td.textContent();
    if (name == "Prob1")
    {
      const pid_td = tds.nth(i * 5);
      PID = await pid_td.innerText();
      
      const link = await pid_td.locator("a");
      await link.click();
      break;
    }
  }
  await page.waitForTimeout(1000);
  
  //Get into test page
  await page.getByRole("link", { name: "Test" }).click();
  await page.waitForTimeout(1000);
  
  //TODO: See testcases
});

//012
test("Student can see submission list", async ({ page }) => {
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Submissions" }).click();

  await expect(page.locator(".card-title").first()).toHaveText("Submissions");

  const table = await page.locator(".card table").first();
  await expect(table.locator("th")).toHaveCount(9);
  await expect(table.locator("th")).toHaveText(
    ["ID", "PID", "User", "Result", "Score", "Run Time", "Memory", "Lang", "Time"],
    { ignoreCase: true },
  );
});










