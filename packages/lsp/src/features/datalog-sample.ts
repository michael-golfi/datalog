export const DATALOG_SAMPLE = `% SUBGRAPH 00: CORE ONTOLOGY SCHEMA + COMPOUND SHAPES
DefPred("food/preferred_label", "1", "liquid/node", "0", "liquid/string").
DefPred("food/subclass_of", "0", "liquid/node", "0", "liquid/node").
DefPred("food/instance_of", "0", "liquid/node", "0", "liquid/node").
DefPred("food/has_cuisine", "0", "liquid/node", "0", "liquid/node").
Edge("class/Thing", "food/preferred_label", "Thing").
Edge("class/FoodConcept", "food/preferred_label", "Food concept").
Edge("class/FoodConcept", "food/subclass_of", "class/Thing").
Edge("concept/chickpea_bowl", "food/instance_of", "class/FoodConcept").
Edge("concept/chickpea_bowl", "food/has_cuisine", "cuisine/mediterranean").

Serving@(serv/id="serv/chickpea_bowl", serv/subject="concept/chickpea_bowl", serv/unit="unit/serving").

ClassAncestor(child_class, parent_class) :-
  Edge(child_class, "food/subclass_of", parent_class).

EntityClass(entity_id, class_id) :-
  Edge(entity_id, "food/instance_of", class_id),
  ClassAncestor(class_id, "class/Thing").`;
