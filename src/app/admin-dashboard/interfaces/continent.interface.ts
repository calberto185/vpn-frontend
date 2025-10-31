export class ContinentEntity {
  id = "";
  name = "";
  displayName = "";
  flag = "";
  descripcion = "";
  idiomas = "";
  isActive = true;
  createdAt = new Date();
  updatedAt = new Date();


  constructor() {}
  set({
    id,
    name,
    displayName,
    flag,
    descripcion,
    idiomas,
    isActive,
    createdAt,
    updatedAt,
  }: ContinentEntity) {
    this.id = id ?? this.id;
    this.name = name ?? this.name;
    this.displayName = displayName ?? this.displayName;
    this.flag = flag ?? this.flag;
    this.descripcion = descripcion ?? this.descripcion;
    this.idiomas = idiomas ?? this.idiomas;
    this.isActive = isActive ?? this.isActive;
    this.createdAt = createdAt ?? this.createdAt;
    this.updatedAt = updatedAt ?? this.updatedAt;
  }
  get() {
    if(!this.id) throw new Error('The id field is required!.');
    if(!this.name) throw new Error('The name field is required!.');
    if(!this.displayName) throw new Error('The displayName field is required!.');
    if(!this.flag) throw new Error('The flag field is required!.');
    if(!this.descripcion) throw new Error('The descripcion field is required!.');
    if(!this.idiomas) throw new Error('The idiomas field is required!.');
    return this;
  }
}
