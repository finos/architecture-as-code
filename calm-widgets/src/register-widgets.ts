import * as Handlebars from 'handlebars';
import { CalmWidgetHelpers } from './helpers/calm-widget-helpers.js';

/**
 * Register all CALM widget helpers with Handlebars
 */
export function registerCalmWidgets(): void {
  const helpers = CalmWidgetHelpers.getHelpers();
  
  for (const [name, helper] of Object.entries(helpers)) {
    Handlebars.registerHelper(name, helper);
  }
  
  console.log(`Registered ${Object.keys(helpers).length} CALM widget helpers`);
}

/**
 * Register CALM widget helpers with a specific Handlebars instance
 */
export function registerCalmWidgetsWithInstance(handlebarsInstance: typeof Handlebars): void {
  const helpers = CalmWidgetHelpers.getHelpers();
  
  for (const [name, helper] of Object.entries(helpers)) {
    handlebarsInstance.registerHelper(name, helper);
  }
  
  console.log(`Registered ${Object.keys(helpers).length} CALM widget helpers with instance`);
}
