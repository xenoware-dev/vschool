// Centralized error handling middleware
// Must have 4 params for Express to treat it as error middleware
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.status || (res.statusCode === 200 ? 500 : res.statusCode);
  let message = err.message || 'Internal Server Error';

  // Prisma: unique constraint
  if (err.code === 'P2002') {
    statusCode = 400;
    const fields = err.meta?.target || err.meta?.driverAdapterError?.cause?.constraint?.fields;
    message = fields ? `Duplicate value for: ${[].concat(fields).join(', ')}` : 'Duplicate value';
  }

  // Prisma: record not found, or an id that is not a valid UUID
  if (err.code === 'P2025' || err.code === 'P2023' || /invalid input syntax for type uuid/i.test(message)) {
    statusCode = 404;
    message = 'Resource not found';
  }

  // Prisma: bad input (wrong enum value, missing field)
  if (err.name === 'PrismaClientValidationError') {
    statusCode = 400;
    message = 'Invalid request data';
  }

  if (statusCode >= 500) console.error(err);

  res.status(statusCode).json({
    message: statusCode >= 500 && process.env.NODE_ENV === 'production' ? 'Internal Server Error' : message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

export default errorHandler;
