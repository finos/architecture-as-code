import { SubmitHandler, useForm } from "react-hook-form";
import './ControlForm.css';

type Inputs = {
    example: string
    exampleRequired: string
  }

export function ControlForm() {
    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
      } = useForm<Inputs>()
      const onSubmit: SubmitHandler<Inputs> = (data) => console.log(data)
    
      console.log(watch("example")) // watch input value by passing the name of it
    
      return (
        /* "handleSubmit" will validate your inputs before invoking "onSubmit" */
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* register your input into the hook by invoking the "register" function */}
          <input className="input input-primary" defaultValue="test" {...register("example")} />
    
          {/* include validation with required or other standard HTML validation rules */}
          <input className="input input-primary" {...register("exampleRequired", { required: true })} />
          {/* errors will return when field validation fails  */}
          {errors.exampleRequired && <span>This field is required</span>}
    
          <input className="input input-primary" type="submit" />
        </form>
      )
}