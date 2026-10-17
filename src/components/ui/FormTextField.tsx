import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { TextField, type TextFieldProps } from './TextField';

type Props<T extends FieldValues> = { control: Control<T>; name: Path<T> } & Omit<
  TextFieldProps,
  'value' | 'onChangeText' | 'error' | 'onBlur'
>;

/** TextField ligado ao React Hook Form. */
export function FormTextField<T extends FieldValues>({ control, name, ...rest }: Props<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          {...rest}
          value={(field.value as string | undefined) ?? ''}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}
