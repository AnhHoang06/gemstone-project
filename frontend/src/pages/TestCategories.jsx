import { useEffect, useState } from "react";
import api from "../api/api";

function TestCategories() {
    const [categories, setCategories] = useState([]);

    useEffect(() => {
        api.get("/categories")
            .then((response) => {
                setCategories(response.data);
            })
            .catch((error) => {
                console.error(error);
            });
    }, []);

    return (
        <div>
            <h1>Danh mục</h1>

            {categories.map((category) => (
                <div key={category.id}>
                    {category.name}
                </div>
            ))}
        </div>
    );
}

export default TestCategories;
