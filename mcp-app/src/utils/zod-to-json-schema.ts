import { z } from 'zod';

type JsonSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';

type JsonSchema = {
  type?: JsonSchemaType | JsonSchemaType[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: Array<string | number | boolean | null>;
  description?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  additionalProperties?: boolean | JsonSchema;
};

type McpToolInputSchema = {
  type: 'object';
  properties?: Record<string, object>;
  required?: string[];
  [key: string]: unknown;
};

export const zodToJsonSchema = (schema: z.ZodTypeAny): McpToolInputSchema => {
  const result = convertZodType(schema);
  return {
    type: 'object',
    properties: result.properties as Record<string, object>,
    required: result.required,
  };
};

const convertZodType = (schema: z.ZodTypeAny): JsonSchema => {
  const typeName = schema._def.typeName as string;

  switch (typeName) {
    case 'ZodString':
      return {
        type: 'string',
        ...(schema._def.description ? { description: schema._def.description } : {}),
      };

    case 'ZodNumber':
      return {
        type: 'number',
        ...(schema._def.description ? { description: schema._def.description } : {}),
      };

    case 'ZodBoolean':
      return {
        type: 'boolean',
        ...(schema._def.description ? { description: schema._def.description } : {}),
      };

    case 'ZodEnum': {
      const enumSchema = schema as z.ZodEnum<[string, ...string[]]>;
      return {
        type: 'string',
        enum: enumSchema._def.values,
        ...(schema._def.description ? { description: schema._def.description } : {}),
      };
    }

    case 'ZodArray': {
      const arraySchema = schema as z.ZodArray<z.ZodTypeAny>;
      return {
        type: 'array',
        items: convertZodType(arraySchema._def.type),
        ...(schema._def.description ? { description: schema._def.description } : {}),
      };
    }

    case 'ZodObject': {
      const objectSchema = schema as z.ZodObject<z.ZodRawShape>;
      const shape = objectSchema._def.shape();
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        const fieldSchema = value as z.ZodTypeAny;
        properties[key] = convertZodType(fieldSchema);

        const isOptional =
          fieldSchema._def.typeName === 'ZodOptional' ||
          fieldSchema._def.typeName === 'ZodDefault';
        if (!isOptional) {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        ...(required.length > 0 ? { required } : {}),
        ...(schema._def.description ? { description: schema._def.description } : {}),
      };
    }

    case 'ZodOptional': {
      const optionalSchema = schema as z.ZodOptional<z.ZodTypeAny>;
      return convertZodType(optionalSchema._def.innerType);
    }

    case 'ZodDefault': {
      const defaultSchema = schema as z.ZodDefault<z.ZodTypeAny>;
      const innerSchema = convertZodType(defaultSchema._def.innerType);
      return {
        ...innerSchema,
        default: defaultSchema._def.defaultValue(),
      };
    }

    case 'ZodNullable': {
      const nullableSchema = schema as z.ZodNullable<z.ZodTypeAny>;
      const innerSchema = convertZodType(nullableSchema._def.innerType);
      return {
        ...innerSchema,
        type: [innerSchema.type as JsonSchemaType, 'null'],
      };
    }

    default:
      return { type: 'object' };
  }
};
