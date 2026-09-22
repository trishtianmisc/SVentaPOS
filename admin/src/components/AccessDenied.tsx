export function AccessDenied() {
  return (
    <div className="w-full p-4 md:p-6">
      <p className="text-sm text-gray-500">
        Platform administrators only. Your account is not allowlisted.
      </p>
    </div>
  );
}
