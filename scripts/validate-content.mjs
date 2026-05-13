import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const eventsDir = path.join(root, 'src/content/events');

const CATEGORY_BY_FILE = {
  'communication.ts': 'A',
  'planning.ts': 'B',
  'engineering.ts': 'C',
  'organization.ts': 'D',
  'launch.ts': 'E',
  'industry.ts': 'F',
  'culture.ts': 'G',
  'comedy.ts': 'H',
  'incident.ts': 'I',
  'conflict.ts': 'J',
  'workstyle.ts': 'K',
};

const VALID_CATEGORIES = new Set(Object.values(CATEGORY_BY_FILE));
const TEXT_LIMITS = {
  title: 60,
  description: 360,
  label: 48,
  summary: 160,
};
const GATE_LIMITS = {
  minProductCount: { min: 0, max: 100 },
  minReputation: { min: 0, max: 1000 },
};

function propName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return undefined;
}

function findProperty(object, name) {
  return object.properties.find(
    (property) => ts.isPropertyAssignment(property) && propName(property.name) === name,
  );
}

function stringValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return undefined;
}

function numberValue(node) {
  if (ts.isNumericLiteral(node)) return Number(node.text);
  return undefined;
}

function unwrapExpression(node) {
  while (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) node = node.expression;
  return node;
}

function findVariable(source, name) {
  let found;

  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      found = node;
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return found;
}

function location(source, node) {
  const pos = source.getLineAndCharacterOfPosition(node.getStart(source));
  return `${path.relative(root, source.fileName)}:${pos.line + 1}:${pos.character + 1}`;
}

function collectEvents(source) {
  const events = [];

  function visit(node) {
    if (ts.isObjectLiteralExpression(node) && findProperty(node, 'id') && findProperty(node, 'choices')) {
      events.push(node);
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return events;
}

function requireString(errors, source, eventId, object, propertyName, maxLength) {
  const property = findProperty(object, propertyName);
  if (!property || !ts.isPropertyAssignment(property)) {
    errors.push(`${location(source, object)} ${eventId}: missing ${propertyName}`);
    return undefined;
  }

  const value = stringValue(property.initializer);
  if (value === undefined) {
    errors.push(`${location(source, property)} ${eventId}: ${propertyName} must be a static string`);
    return undefined;
  }

  if (value.trim().length === 0) {
    errors.push(`${location(source, property)} ${eventId}: ${propertyName} is empty`);
  }
  if (value.length > maxLength) {
    errors.push(
      `${location(source, property)} ${eventId}: ${propertyName} length ${value.length} exceeds ${maxLength}`,
    );
  }
  return value;
}

function validateChoices(errors, source, eventId, eventObject) {
  const property = findProperty(eventObject, 'choices');
  if (!property || !ts.isPropertyAssignment(property) || !ts.isArrayLiteralExpression(property.initializer)) {
    errors.push(`${location(source, eventObject)} ${eventId}: choices must be an array`);
    return;
  }

  const choices = property.initializer.elements.filter(ts.isObjectLiteralExpression);
  if (choices.length < 2 || choices.length > 3 || choices.length !== property.initializer.elements.length) {
    errors.push(`${location(source, property)} ${eventId}: choices count must be 2-3`);
  }

  for (const choice of choices) {
    requireString(errors, source, eventId, choice, 'label', TEXT_LIMITS.label);
    requireString(errors, source, eventId, choice, 'summary', TEXT_LIMITS.summary);
    if (!findProperty(choice, 'apply')) {
      errors.push(`${location(source, choice)} ${eventId}: choice is missing apply`);
    }
  }
}

function validateGate(errors, source, eventId, eventObject, gateName) {
  const property = findProperty(eventObject, gateName);
  if (!property || !ts.isPropertyAssignment(property)) return;

  const value = numberValue(property.initializer);
  const limit = GATE_LIMITS[gateName];
  if (value === undefined || !Number.isInteger(value)) {
    errors.push(`${location(source, property)} ${eventId}: ${gateName} must be an integer literal`);
    return;
  }
  if (value < limit.min || value > limit.max) {
    errors.push(
      `${location(source, property)} ${eventId}: ${gateName} ${value} outside ${limit.min}-${limit.max}`,
    );
  }
}

function validate() {
  const errors = [];
  const seenIds = new Map();
  const counts = Object.fromEntries(Object.values(CATEGORY_BY_FILE).map((category) => [category, 0]));

  for (const [fileName, expectedCategory] of Object.entries(CATEGORY_BY_FILE)) {
    const filePath = path.join(eventsDir, fileName);
    if (!fs.existsSync(filePath)) {
      errors.push(`src/content/events/${fileName}: missing category file`);
      continue;
    }

    const sourceText = fs.readFileSync(filePath, 'utf8');
    const source = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const events = collectEvents(source);

    for (const eventObject of events) {
      const id = requireString(errors, source, '(unknown)', eventObject, 'id', 80) ?? '(unknown)';
      const prior = seenIds.get(id);
      if (prior) {
        errors.push(`${location(source, eventObject)} duplicate id "${id}" already declared at ${prior}`);
      } else {
        seenIds.set(id, location(source, eventObject));
      }

      const category = requireString(errors, source, id, eventObject, 'category', 1);
      if (!category || !VALID_CATEGORIES.has(category)) {
        errors.push(`${location(source, eventObject)} ${id}: category must be one of A-K`);
      } else {
        counts[category] += 1;
        if (category !== expectedCategory) {
          errors.push(
            `${location(source, eventObject)} ${id}: category ${category} does not match ${fileName} (${expectedCategory})`,
          );
        }
      }

      requireString(errors, source, id, eventObject, 'title', TEXT_LIMITS.title);
      requireString(errors, source, id, eventObject, 'description', TEXT_LIMITS.description);
      validateChoices(errors, source, id, eventObject);
      validateGate(errors, source, id, eventObject, 'minProductCount');
      validateGate(errors, source, id, eventObject, 'minReputation');
    }
  }

  const indexPath = path.join(eventsDir, 'index.ts');
  const indexSource = ts.createSourceFile(
    indexPath,
    fs.readFileSync(indexPath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const runtimeOrderDeclaration = findVariable(indexSource, 'EVENT_IDS_IN_RUNTIME_ORDER');
  const runtimeOrderInitializer = runtimeOrderDeclaration?.initializer
    ? unwrapExpression(runtimeOrderDeclaration.initializer)
    : undefined;
  if (!runtimeOrderInitializer || !ts.isArrayLiteralExpression(runtimeOrderInitializer)) {
    errors.push('src/content/events/index.ts: missing EVENT_IDS_IN_RUNTIME_ORDER array');
  } else {
    const orderIds = runtimeOrderInitializer.elements.map((node) => stringValue(node));
    const orderSet = new Set();
    for (const [index, id] of orderIds.entries()) {
      if (!id) {
        errors.push(`src/content/events/index.ts: runtime order entry ${index} must be a string literal`);
        continue;
      }
      if (orderSet.has(id)) errors.push(`src/content/events/index.ts: duplicate runtime order id "${id}"`);
      orderSet.add(id);
      if (!seenIds.has(id)) errors.push(`src/content/events/index.ts: unknown runtime order id "${id}"`);
    }
    for (const id of seenIds.keys()) {
      if (!orderSet.has(id)) errors.push(`src/content/events/index.ts: event "${id}" missing from runtime order`);
    }
  }

  if (errors.length > 0) {
    console.error('Content validation failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  const total = [...seenIds.keys()].length;
  const distribution = Object.entries(counts)
    .map(([category, count]) => `${category}:${count}`)
    .join(' ');
  console.log(`Content validation passed: ${total} events (${distribution})`);
}

validate();
