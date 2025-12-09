import { test, expect } from "@playwright/test";
import path from "path";
import { login_student } from "./utils/arranges";

test.beforeEach(async ({ page, baseURL }) => {
  await login_student(page, baseURL!);
});

test("Student can see visible problem", async ({ page }) => {
  //Get into the problems page
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Problems" }).click();
  
  const tds = page.locator('tr.hover td');
  await page.waitForTimeout(1000);
  const count = await tds.count();
  
  let PID = '';
  for (let i = 0; i < count / 5; ++i){
    const td = tds.nth(i * 5 + 1);
    const name = await td.textContent();
    if (name == 'Hw1')
    {
      const pid_td = tds.nth(i * 5);
      PID = await tds.nth(i * 5).innerText();
      const link = await pid_td.locator('a');
      await link.click();
      break;
    }
  }
  await page.waitForTimeout(1000);
  
  //Check if success
  await expect(page).toHaveURL(`http://localhost:8080/course/meow/problem/${PID}`);
  
});
